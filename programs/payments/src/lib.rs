use anchor_lang::prelude::*;
use instructions::*;

pub mod instructions;
pub mod state;
pub mod events;

// declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS"); // Mainnet
declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS"); // Localnet
// declare_id!("A6t6oiVdncWrbM98YcVbu3fVDsZYrVtj7h2HDqc3Bo7R"); // Devnet

#[program]
pub mod payments {
    use super::*;

    pub fn cancel_purchase(ctx: Context<CancelPurchase>) -> Result<()> {
        instructions::cancel_purchase(ctx)
    }

    pub fn deliver_product(ctx: Context<DeliverProduct>) -> Result<()> {
        instructions::deliver_product(ctx)
    }

    pub fn purchase_product(ctx: Context<PurchaseProduct>, order_id: u64, product_id: u64, price: u64, _vault_account_bump: u8) -> Result<()> {
        instructions::purchase_product(ctx, order_id, product_id, price, _vault_account_bump)
    }

    pub fn refund_purchase(ctx: Context<RefundPurchase>) -> Result<()> {
        instructions::refund_purchase(ctx)
    }
    
}
