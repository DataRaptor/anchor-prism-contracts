import * as anchor from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";

const getProductEscrowPDA = async (
  program: any
  // productUuid: string,
): Promise<[PublicKey, number]> => {
  let [productEscrowPDA, productEscrowBump] =
    await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from(anchor.utils.bytes.utf8.encode("product-escrow")),
        // Buffer.from(anchor.utils.bytes.utf8.encode(productUuid))
      ],
      program.programId
    );
  return [productEscrowPDA, productEscrowBump];
};

const getProductPDA = async (program: any, productId: number) => {
  let [productPDA, _] = await anchor.web3.PublicKey.findProgramAddress(
    [
      Buffer.from(anchor.utils.bytes.utf8.encode("product")),
      Buffer.from(anchor.utils.bytes.utf8.encode(productId.toString())),
    ],
    program.programId
  );
  return productPDA;
};

const getTokenVaultPDA = async (
  program: any,
  productId: number,
  orderId: number
): Promise<[PublicKey, number]> => {
  let [tokenVaultPDA, tokenVaultBump] =
    await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from(anchor.utils.bytes.utf8.encode("token-vault")),
        Buffer.from(productId.toString()),
        Buffer.from(orderId.toString()),
      ],
      program.programId
    );
  return [tokenVaultPDA, tokenVaultBump];
};

export { getProductEscrowPDA, getProductPDA, getTokenVaultPDA };
