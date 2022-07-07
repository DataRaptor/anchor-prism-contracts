
use anchor_lang::prelude::*;


#[event]
pub struct CreateProductEvent {
    #[index]
    pub index: String,
    pub product_uuid: String,
    pub currency: Pubkey,
    pub merchant: Pubkey,
    pub merchant_token_account: Pubkey,
    pub price: u64,
    pub inventory: u64,
    pub bump: u8,
}

pub fn emit_create_product_event(
    product_uuid: String,
    currency: Pubkey,
    merchant: Pubkey,
    merchant_token_account: Pubkey,
    price: u64,
    inventory: u64,
    bump: u8,
) -> Result<()>{
    emit!(
        CreateProductEvent {
            index: "create_product_event".to_string(),
            product_uuid: product_uuid,
            currency: currency,
            merchant: merchant,
            merchant_token_account: merchant_token_account,
            price: price,
            inventory: inventory,
            bump: bump
        }
    );
    Ok(())
}