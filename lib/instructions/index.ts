import { PublicKey, Keypair, Signer } from "@solana/web3.js";
import * as anchor from "@project-serum/anchor";
import { TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";

const cancelPurchaseInstruction = async (
  program: any,
  vaultAccountPDA: PublicKey,
  vaultAuthorityPDA: PublicKey,
  customerMainAccount: Keypair,
  customerTokenAccount: PublicKey,
  productEscrow: Keypair
): Promise<string> => {
  const signature: string = await program.rpc.cancelPurchase({
    accounts: {
      customer: customerMainAccount.publicKey,
      customerDepositTokenAccount: customerTokenAccount,
      vaultAccount: vaultAccountPDA,
      vaultAuthority: vaultAuthorityPDA,
      productEscrow: productEscrow.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    },
    signers: [customerMainAccount],
  });
  return signature;
};

// export const createProductInstruction = async (
//   program: any,
//   productId: number,
//   price: number,
//   inventory: number,
//   productPDA: PublicKey,
//   currency: PublicKey,
//   merchantTokenAccount: PublicKey,
//   merchant: Keypair
// ): Promise<string> => {
//   const signature: string = await program.methods
//     .createProduct(
//       new anchor.BN(productId),
//       new anchor.BN(price),
//       new anchor.BN(inventory),
//     )
//     .accounts({
//         product: productPDA,
//         currency: currency,
//         merchantTokenAccount: merchantTokenAccount,
//         merchant: merchant.publicKey,
//     })
//     .signers([merchant])
//     .rpc()
//   return signature
// }

const deliverProductInstruction = async (
  program: any,
  vaultAccountPDA: PublicKey,
  vaultAuthorityPDA: PublicKey,
  merchantMainAccount: Keypair,
  merchantTokenAccount: PublicKey,
  customerMainAccount: Keypair,
  productEscrow: Keypair
): Promise<string> => {
  const signature: string = await program.rpc.deliverProduct({
    accounts: {
      merchant: merchantMainAccount.publicKey,
      merchantReceiveTokenAccount: merchantTokenAccount,
      customer: customerMainAccount.publicKey,
      productEscrow: productEscrow.publicKey,
      vaultAccount: vaultAccountPDA,
      vaultAuthority: vaultAuthorityPDA,
      tokenProgram: TOKEN_PROGRAM_ID,
    },
    signers: [merchantMainAccount],
  });
  return signature;
};

const purchaseProductInstruction = async (
  program: any,
  orderId: number,
  productId: number,
  price: number,
  vaultAccountPDA: PublicKey,
  vaultAccountBump: number,
  mint: Token,
  customerMainAccount: Keypair,
  customerTokenAccount: PublicKey,
  merchantMainAccount: PublicKey,
  merchantTokenAccount: PublicKey,
  productEscrow: Keypair
): Promise<string> => {
  const signature: string = await program.rpc.purchaseProduct(
    new anchor.BN(orderId),
    new anchor.BN(productId),
    new anchor.BN(price),
    vaultAccountBump,
    {
      accounts: {
        customer: customerMainAccount.publicKey,
        mint: mint.publicKey,
        vaultAccount: vaultAccountPDA,
        customerDepositTokenAccount: customerTokenAccount,
        merchant: merchantMainAccount,
        merchantReceiveTokenAccount: merchantTokenAccount,
        productEscrow: productEscrow.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      instructions: [
        await program.account.productEscrow.createInstruction(productEscrow),
      ],
      signers: [productEscrow, customerMainAccount],
    }
  );
  return signature;
};

const refundPurchaseInstruction = async (
  program: any,
  vaultAccountPDA: PublicKey,
  vaultAuthorityPDA: PublicKey,
  customerMainAccount: Keypair,
  customerTokenAccount: PublicKey,
  productEscrow: Keypair
): Promise<string> => {
  const signature: string = await program.rpc.refundPurchase({
    accounts: {
      customer: customerMainAccount.publicKey,
      customerDepositTokenAccount: customerTokenAccount,
      vaultAccount: vaultAccountPDA,
      vaultAuthority: vaultAuthorityPDA,
      productEscrow: productEscrow.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    },
    signers: [customerMainAccount],
  });
  return signature;
};

export {
  cancelPurchaseInstruction,
  deliverProductInstruction,
  purchaseProductInstruction,
  refundPurchaseInstruction,
};
