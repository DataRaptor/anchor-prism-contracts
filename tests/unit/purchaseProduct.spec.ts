import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet";
import { Payments } from "../../target/types/payments";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  Connection,
  Commitment,
  AccountInfo,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
import { assert, expect } from "chai";
import {
  getProductPDA,
  getProductEscrowPDA,
  getTokenVaultPDA,
  cancelPurchaseInstruction,
  createProductInstruction,
  deliverProductInstruction,
  purchaseProductInstruction,
  refundPurchaseInstruction,
  generateOrderId,
  generateProductId,
} from "../../lib";
import {
  getSolanaEnv,
  getProductEscrowAccount,
  createTreasury,
  createProductEscrow,
  createUser,
  createCurrency,
  mintCurrencyTo,
  getSolanaAccountInfoFromPublicKey,
  getTokenAccountInfoFromCurrency,
  deserializeBN,
  expectThrowsAsync,
} from "../utils";
import { Currency, User } from "../types";

const { provider, connection, program } = getSolanaEnv();
anchor.setProvider(provider);

describe("⚛️  Unit: purchaseProductInstruction", () => {
  it("✨  Valid transaction, the instruction is the expected use and should successfully execute.", async () => {
    // Merchant creates a product.
    const productId: number = generateProductId();
    const orderId: number = generateOrderId();
    const [productPDA, productBump] = await getProductPDA(program, productId);

    const cancellable: boolean = true;
    const price: number = 1_000_000;
    const treasury: anchor.web3.Keypair = createTreasury();
    const currency: Currency = await createCurrency();
    const merchantUser: User = await createUser(currency);

    await createProductInstruction(
      program,
      treasury.publicKey,
      productId,
      price,
      cancellable,
      productPDA,
      productBump,
      currency.mint.publicKey,
      merchantUser.tokenAccount,
      merchantUser.keypair
    );

    // Customer creates a product escrow account and purchases product.
    const productEscrow: anchor.web3.Keypair = createProductEscrow();
    const [vaultAccountPDA, vaultAccountBump] = await getTokenVaultPDA(
      program,
      productId,
      orderId
    );
    const [vaultAuthorityPDA, _vaultAuthorityBump] = await getProductEscrowPDA(
      program
    );

    const customerUser: User = await createUser(currency);
    await mintCurrencyTo(
      currency,
      customerUser.tokenAccount,
      price // mint price tokens to customer.
    );

    await purchaseProductInstruction(
      program,
      orderId,
      productId,
      productPDA,
      price,
      vaultAccountPDA,
      vaultAccountBump,
      currency.mint,
      customerUser.keypair,
      customerUser.tokenAccount,
      merchantUser.keypair.publicKey,
      merchantUser.tokenAccount,
      productEscrow
    );

    const merchantTokenAccount = await getTokenAccountInfoFromCurrency(
      currency,
      merchantUser.tokenAccount
    );
    expect(merchantTokenAccount.amount.toNumber()).to.eql(
      0,
      "The merchant has tokens they should not"
    );

    const customerTokenAccount = await getTokenAccountInfoFromCurrency(
      currency,
      customerUser.tokenAccount
    );
    expect(customerTokenAccount.amount.toNumber()).to.eql(
      0,
      "The customer has tokens they should not"
    );

    const vaultAccountInfo = await getTokenAccountInfoFromCurrency(
      currency,
      vaultAccountPDA
    );
    expect(vaultAccountInfo.owner.toString()).to.eql(
      vaultAuthorityPDA.toString(),
      "Vault account owner incorrectly set"
    );
    expect(vaultAccountInfo.amount.toNumber()).to.eql(
      price,
      "Vault account does not have the correct number of tokens"
    );

    const productEscrowAccount = await getProductEscrowAccount(
      productEscrow.publicKey
    );
    expect(productEscrowAccount.productId.toNumber()).to.eql(
      productId,
      "Mismatched productIds"
    );
    expect(productEscrowAccount.orderId.toNumber()).to.eql(
      orderId,
      "Mismatched orderIds"
    );
    expect(productEscrowAccount.customer.toString()).to.eql(
      customerUser.keypair.publicKey.toString(),
      "Mismatched customer pubkeys"
    );
    expect(productEscrowAccount.merchant.toString()).to.eql(
      merchantUser.keypair.publicKey.toString(),
      "Mistmatched merchant pubkeys"
    );
    expect(productEscrowAccount.customerDepositTokenAccount.toString()).to.eql(
      customerUser.tokenAccount.toString(),
      "Mistmatched customer token accounts"
    );
    expect(productEscrowAccount.merchantReceiveTokenAccount.toString()).to.eql(
      merchantUser.tokenAccount.toString(),
      "Mistmatched merchant token accounts"
    );
    expect(productEscrowAccount.amount.toNumber()).to.eql(
      price,
      "Mismatched prices"
    );
    expect(productEscrowAccount.delivered).to.eql(
      false,
      "Delivered should initialize to false"
    );
    expect(productEscrowAccount.refunded).to.eql(
      false,
      "Refunded should initialize to false"
    );
    expect(productEscrowAccount.cancelled).to.eql(
      false,
      "Cancelled should initialize to false"
    );
  });

  it("Invalid transaction, the customer attempted to purchase a product for less than the product's price", async () => {
    // Merchant creates a product.
    const productId: number = generateProductId();
    const orderId: number = generateOrderId();
    const [productPDA, productBump] = await getProductPDA(program, productId);

    const cancellable: boolean = true;
    const price: number = 1_000_000;
    const treasury: anchor.web3.Keypair = createTreasury();
    const currency: Currency = await createCurrency();
    const merchantUser: User = await createUser(currency);

    await createProductInstruction(
      program,
      treasury.publicKey,
      productId,
      price,
      cancellable,
      productPDA,
      productBump,
      currency.mint.publicKey,
      merchantUser.tokenAccount,
      merchantUser.keypair
    );

    // Customer creates a product escrow account and purchases product.
    const productEscrow: anchor.web3.Keypair = createProductEscrow();
    const [vaultAccountPDA, vaultAccountBump] = await getTokenVaultPDA(
      program,
      productId,
      orderId
    );
    const [vaultAuthorityPDA, _vaultAuthorityBump] = await getProductEscrowPDA(
      program
    );

    const customerUser: User = await createUser(currency);
    await mintCurrencyTo(
      currency,
      customerUser.tokenAccount,
      price // mint price tokens to customer.
    );

    await expectThrowsAsync(
      async () =>
        await purchaseProductInstruction(
          program,
          orderId,
          productId,
          productPDA,
          price - 1, // 1 less than the amount required for the product.
          vaultAccountPDA,
          vaultAccountBump,
          currency.mint,
          customerUser.keypair,
          customerUser.tokenAccount,
          merchantUser.keypair.publicKey,
          merchantUser.tokenAccount,
          productEscrow
        ),
      null
    );
  });

  it("Invalid transaction, the customer attempted to purchase a product for more than the product's price", async () => {
    // Merchant creates a product.
    const productId: number = generateProductId();
    const orderId: number = generateOrderId();
    const [productPDA, productBump] = await getProductPDA(program, productId);

    const cancellable: boolean = true;
    const price: number = 1_000_000;
    const treasury: anchor.web3.Keypair = createTreasury();
    const currency: Currency = await createCurrency();
    const merchantUser: User = await createUser(currency);

    await createProductInstruction(
      program,
      treasury.publicKey,
      productId,
      price,
      cancellable,
      productPDA,
      productBump,
      currency.mint.publicKey,
      merchantUser.tokenAccount,
      merchantUser.keypair
    );

    // Customer creates a product escrow account and purchases product.
    const productEscrow: anchor.web3.Keypair = createProductEscrow();
    const [vaultAccountPDA, vaultAccountBump] = await getTokenVaultPDA(
      program,
      productId,
      orderId
    );
    const [vaultAuthorityPDA, _vaultAuthorityBump] = await getProductEscrowPDA(
      program
    );

    const customerUser: User = await createUser(currency);
    await mintCurrencyTo(
      currency,
      customerUser.tokenAccount,
      price // mint price tokens to customer.
    );

    await expectThrowsAsync(
      async () =>
        await purchaseProductInstruction(
          program,
          orderId,
          productId,
          productPDA,
          price + 1, // 1 more than the amount required for the product.
          vaultAccountPDA,
          vaultAccountBump,
          currency.mint,
          customerUser.keypair,
          customerUser.tokenAccount,
          merchantUser.keypair.publicKey,
          merchantUser.tokenAccount,
          productEscrow
        ),
      null
    );
  });

  it("Invalid transaction, the customer attempted to purchase a product using an invalid currency and token account", async () => {
    // Merchant creates a product.
    const productId: number = generateProductId();
    const orderId: number = generateOrderId();
    const [productPDA, productBump] = await getProductPDA(program, productId);

    const cancellable: boolean = true;
    const price: number = 1_000_000;
    const treasury: anchor.web3.Keypair = createTreasury();
    const currency: Currency = await createCurrency();
    const merchantUser: User = await createUser(currency);

    await createProductInstruction(
      program,
      treasury.publicKey,
      productId,
      price,
      cancellable,
      productPDA,
      productBump,
      currency.mint.publicKey,
      merchantUser.tokenAccount,
      merchantUser.keypair
    );

    // Customer creates a product escrow account and purchases product.
    const productEscrow: anchor.web3.Keypair = createProductEscrow();
    const [vaultAccountPDA, vaultAccountBump] = await getTokenVaultPDA(
      program,
      productId,
      orderId
    );
    const [vaultAuthorityPDA, _vaultAuthorityBump] = await getProductEscrowPDA(
      program
    );

    const maliciousCurrency: Currency = await createCurrency()
    const customerUser: User = await createUser(maliciousCurrency);
    await mintCurrencyTo(
      maliciousCurrency,
      customerUser.tokenAccount,
      price // mint price tokens to customer.
    );

    await expectThrowsAsync(
      async () =>
        await purchaseProductInstruction(
          program,
          orderId,
          productId,
          productPDA,
          price,
          vaultAccountPDA,
          vaultAccountBump,
          maliciousCurrency.mint,
          customerUser.keypair,
          customerUser.tokenAccount,
          merchantUser.keypair.publicKey,
          merchantUser.tokenAccount,
          productEscrow
        ),
      null
    );
  });

  it("Invalid transaction, the customer attempted to purchase a product using an invalid currency and token account", async () => {
    // Merchant creates a product.
    const productId: number = generateProductId();
    const orderId: number = generateOrderId();
    const [productPDA, productBump] = await getProductPDA(program, productId);

    const cancellable: boolean = true;
    const price: number = 1_000_000;
    const treasury: anchor.web3.Keypair = createTreasury();
    const currency: Currency = await createCurrency();
    const merchantUser: User = await createUser(currency);

    await createProductInstruction(
      program,
      treasury.publicKey,
      productId,
      price,
      cancellable,
      productPDA,
      productBump,
      currency.mint.publicKey,
      merchantUser.tokenAccount,
      merchantUser.keypair
    );

    // Customer creates a product escrow account and purchases product.
    const productEscrow: anchor.web3.Keypair = createProductEscrow();
    const [vaultAccountPDA, vaultAccountBump] = await getTokenVaultPDA(
      program,
      productId,
      orderId
    );
    const [vaultAuthorityPDA, _vaultAuthorityBump] = await getProductEscrowPDA(
      program
    );

    const maliciousCurrency: Currency = await createCurrency()
    const customerUser: User = await createUser(maliciousCurrency);
    await mintCurrencyTo(
      maliciousCurrency,
      customerUser.tokenAccount,
      price // mint price tokens to customer.
    );

    await expectThrowsAsync(
      async () =>
        await purchaseProductInstruction(
          program,
          orderId,
          productId,
          productPDA,
          price,
          vaultAccountPDA,
          vaultAccountBump,
          maliciousCurrency.mint,
          customerUser.keypair,
          customerUser.tokenAccount,
          merchantUser.keypair.publicKey,
          merchantUser.tokenAccount,
          productEscrow
        ),
      null
    );
  });
  
});
