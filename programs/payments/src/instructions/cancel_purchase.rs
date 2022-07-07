use crate::state::product_escrow::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, TokenAccount, Transfer};

pub fn cancel_purchase(ctx: Context<CancelPurchase>) -> Result<()> {
    // assert_eq!(ctx.accounts.product_escrow.delivered, false);
    let (_vault_authority, vault_authority_bump) =
        Pubkey::find_program_address(&[b"product-escrow"], ctx.program_id);
    let authority_seeds = &[&b"product-escrow"[..], &[vault_authority_bump]];
    token::transfer(
        ctx.accounts
            .into_transfer_from_vault_to_customer_context()
            .with_signer(&[&authority_seeds[..]]),
        ctx.accounts.product_escrow.amount,
    )?;
    token::close_account(
        ctx.accounts
            .into_close_context()
            .with_signer(&[&authority_seeds[..]]),
    )?;
    ctx.accounts.product_escrow.cancelled = true;
    Ok(())
}

#[derive(Accounts)]
pub struct CancelPurchase<'info> {
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(
        mut, 
        signer,
        constraint = *customer.key == customer_deposit_token_account.owner,
        constraint = *customer.key == product_escrow.customer, 
    )]
    pub customer: AccountInfo<'info>,
    #[account(mut)]
    pub vault_account: Account<'info, TokenAccount>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub vault_authority: AccountInfo<'info>,
    #[account(
        mut,
        constraint = customer_deposit_token_account.owner == *customer.key,
        constraint = customer_deposit_token_account.owner == product_escrow.customer
    )]
    pub customer_deposit_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = product_escrow.customer == *customer.key,
        constraint = product_escrow.customer == product_escrow.customer,
        constraint = product_escrow.delivered == false,
        constraint = product_escrow.cancelled == false,
        constraint = product_escrow.refunded == false
    )]
    pub product_escrow: Box<Account<'info, ProductEscrow>>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub token_program: AccountInfo<'info>,
}

impl<'info> CancelPurchase<'info> {
    fn into_transfer_from_vault_to_customer_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.vault_account.to_account_info().clone(),
            to: self
                .customer_deposit_token_account
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