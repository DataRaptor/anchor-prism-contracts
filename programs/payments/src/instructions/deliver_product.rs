use crate::state::product_escrow::*;
use crate::state::product::*;
use crate::events::deliver_product_event;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, TokenAccount, Transfer};

pub fn deliver_product(ctx: Context<DeliverProduct>, _product_id: u64) -> Result<()> {
    let (_vault_authority, vault_authority_bump) =
        Pubkey::find_program_address(&[b"product-escrow"], ctx.program_id);
    let authority_seeds = &[&b"product-escrow"[..], &[vault_authority_bump]];
    token::transfer(
        ctx.accounts
            .into_transfer_from_vault_to_merchant_context()
            .with_signer(&[&authority_seeds[..]]),
        ctx.accounts.product_escrow.amount,
    )?;
    token::close_account(
        ctx.accounts
            .into_close_context()
            .with_signer(&[&authority_seeds[..]]),
    )?;
    ctx.accounts.product_escrow.delivered = true;
    deliver_product_event::emit(
        ctx.accounts.product_escrow.product_id,
        ctx.accounts.product_escrow.order_id,
        ctx.accounts.product_escrow.merchant,
        ctx.accounts.product_escrow.merchant_receive_token_account,
        ctx.accounts.product_escrow.customer,
        ctx.accounts.product_escrow.customer_deposit_token_account,
        ctx.accounts.product_escrow.currency,
        ctx.accounts.product_escrow.amount,
        ctx.accounts.product_escrow.delivered,
        ctx.accounts.product_escrow.cancelled,
        ctx.accounts.product_escrow.refunded,
    )?;
    Ok(())
}

#[derive(Accounts)]
#[instruction(product_id: u64)]
pub struct DeliverProduct<'info> {
    #[account(
        signer,
        constraint = *merchant.key == product_escrow.merchant,
        constraint = *merchant.key == merchant_receive_token_account.owner
    )]
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub merchant: AccountInfo<'info>,
    #[account(
        mut,
        constraint = merchant_receive_token_account.owner == *merchant.key
    )]
    pub merchant_receive_token_account: Box<Account<'info, TokenAccount>>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub customer: AccountInfo<'info>,
    #[account(
        mut,
        constraint = product_escrow.product_id == product_id,
        constraint = product_escrow.merchant == product.merchant,
        constraint = product_escrow.currency == product.mint,
        constraint = product_escrow.customer == *customer.key,
        constraint = product_escrow.merchant == *merchant.key,
        constraint = product_escrow.delivered == false,
        constraint = product_escrow.refunded == false,
        constraint = product_escrow.cancelled == false,
        // close = customer
    )]
    pub product_escrow: Box<Account<'info, ProductEscrow>>,
    #[account(
        mut,
        seeds = [
            b"product",
            product_id.to_string().as_ref(),
        ],
        bump = product.bump,
        constraint = product.product_id == product_id,
        constraint = product.merchant == product_escrow.merchant,
        constraint = product.mint == product_escrow.currency,
        constraint = product.merchant == *merchant.key,
    )]
    pub product: Box<Account<'info, Product>>,
    #[account(mut)]
    pub vault_account: Box<Account<'info, TokenAccount>>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub vault_authority: AccountInfo<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub token_program: AccountInfo<'info>,
}

impl<'info> DeliverProduct<'info> {

    fn into_transfer_from_vault_to_merchant_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.vault_account.to_account_info().clone(),
            to: self
                .merchant_receive_token_account
                .to_account_info()
                .clone(),
            authority: self.vault_authority.clone(),
        };
        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }

    fn into_close_context(&self) -> CpiContext<'_, '_, '_, 'info, CloseAccount<'info>> {
        let cpi_accounts = CloseAccount {
            account: self.vault_account.to_account_info().clone(),
            destination: self.customer.clone(),
            authority: self.vault_authority.clone(),
        };
        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }
}