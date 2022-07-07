import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet";
import { Payments } from "../target/types/payments";
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
  deliverProductInstruction,
  purchaseProductInstruction,
  refundPurchaseInstruction,
  generateOrderId,
  generateProductId,
} from "../lib";

describe("Prism Payments", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider: anchor.Provider = anchor.getProvider();
  // const _connection: Connection = provider.connection;

  anchor.setProvider(provider);

  const program = anchor.workspace.Payments as Program<Payments>;

  let mint = null as Token;
  let customerTokenAccount = null;
  let merchantTokenAccount = null;
  let vault_account_pda = null;
  let vault_account_bump = null;
  let vault_authority_pda = null;
  // let orderId = null as number;

  const amount = 500;
  const price = amount;
  const productId = generateProductId()

  // var productEscrow = null as anchor.web3.Keypair
  const payer = anchor.web3.Keypair.generate();
  const mintAuthority = anchor.web3.Keypair.generate();
  const customerMainAccount = anchor.web3.Keypair.generate();
  const merchantMainAccount = anchor.web3.Keypair.generate();

  it("[setup] Airdrop Sol, creates mint, creates token accounts, send tokens to customer", async () => {
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(payer.publicKey, 1000000000),
      "confirmed"
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        customerMainAccount.publicKey,
        10000000000
      ),
      "confirmed"
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        merchantMainAccount.publicKey,
        10000000000
      ),
      "confirmed"
    );
    mint = await Token.createMint(
      provider.connection,
      payer,
      mintAuthority.publicKey,
      null,
      0,
      TOKEN_PROGRAM_ID
    );
    customerTokenAccount = await mint.createAccount(
      customerMainAccount.publicKey
    );
    merchantTokenAccount = await mint.createAccount(
      merchantMainAccount.publicKey
    );
    await mint.mintTo(
      customerTokenAccount,
      mintAuthority.publicKey,
      [mintAuthority],
      amount * 10
    );
    let _customerTokenAccount = await mint.getAccountInfo(customerTokenAccount);
    let _merchantTokenAccount = await mint.getAccountInfo(merchantTokenAccount);
    assert.ok(_customerTokenAccount.amount.toNumber() == amount * 10);
    assert.ok(_merchantTokenAccount.amount.toNumber() == 0);
  });

  // it("Merchant creates product", async() => {
  //   const productPDA = await getProductPDA(program, productId)
  //   product_pda = productPDA

  //   await createProductInstruction(
  //     program,
  //     productId,
  //     amount,
  //     productInventory,
  //     productPDA,
  //     mint.publicKey,
  //     merchantTokenAccount,
  //     merchantMainAccount
  //   )
  //   let productAccount = await program.account.product.fetch(productPDA)
  //   // expect(productAccount.currency.toString()).to.eql(mint.publicKey.toString());
  //   // expect(productAccount.merchantTokenAccount).to.eql(merchantTokenAccount.address);
  //   expect(deserializeBN(productAccount.price)).to.eql(new anchor.BN(amount));
  //   expect(deserializeBN(productAccount.inventory)).to.eql(new anchor.BN(productInventory));
  // })

  it("Customer purchases product", async () => {
    const orderId = generateOrderId();
    const productEscrow = anchor.web3.Keypair.generate();
    const [_vault_account_pda, _vault_account_bump] = await getTokenVaultPDA(
      program,
      productId,
      orderId
    );
    vault_account_pda = _vault_account_pda;
    vault_account_bump = _vault_account_bump;
    const [_vault_authority_pda, _vault_authority_bump] =
      await getProductEscrowPDA(program);
    vault_authority_pda = _vault_authority_pda;
    await purchaseProductInstruction(
      program,
      orderId,
      productId,
      price,
      _vault_account_pda,
      _vault_account_bump,
      mint,
      customerMainAccount,
      customerTokenAccount,
      merchantMainAccount.publicKey,
      merchantTokenAccount,
      productEscrow
    );
    let _vault = await mint.getAccountInfo(vault_account_pda);
    let _productEscrow = await program.account.productEscrow.fetch(
      productEscrow.publicKey
    );
    assert.ok(_productEscrow.delivered == false);
    assert.ok(_productEscrow.refunded == false);
    assert.ok(_productEscrow.cancelled == false);
    assert.ok(_vault.owner.equals(vault_authority_pda));
    assert.ok(_vault.amount.toNumber() == amount);
    assert.ok(_productEscrow.customer.equals(customerMainAccount.publicKey));
    assert.ok(_productEscrow.amount.toNumber() == amount);
    assert.ok(
      _productEscrow.customerDepositTokenAccount.equals(customerTokenAccount)
    );
    assert.ok(_productEscrow.productId.toNumber() == productId);
    assert.ok(_productEscrow.orderId.toNumber() == orderId);
  });

  it("Merchant delivers product", async () => {
    const orderId = generateOrderId();
    const productEscrow = anchor.web3.Keypair.generate();
    const [_vault_account_pda, _vault_account_bump] = await getTokenVaultPDA(
      program,
      productId,
      orderId
    );
    const [_vault_authority_pda, _vault_authority_bump] =
      await getProductEscrowPDA(program);
    await purchaseProductInstruction(
      program,
      orderId,
      productId,
      price,
      _vault_account_pda,
      _vault_account_bump,
      mint,
      customerMainAccount,
      customerTokenAccount,
      merchantMainAccount.publicKey,
      merchantTokenAccount,
      productEscrow
    );
    await deliverProductInstruction(
      program,
      _vault_account_pda,
      _vault_authority_pda,
      merchantMainAccount,
      merchantTokenAccount,
      customerMainAccount,
      productEscrow
    );
    // This breaks because we close the escrow account when we are done with it.
    // let _vault = await mint.getAccountInfo(vault_account_pda)
    // assert.ok(_vault.amount.toNumber() == 0);
    let _productEscrow = await program.account.productEscrow.fetch(
      productEscrow.publicKey
    );
    assert.ok(_productEscrow.delivered == true);
    assert.ok(_productEscrow.refunded == false);
    assert.ok(_productEscrow.cancelled == false);
    let _merchantTokenAccount = await mint.getAccountInfo(merchantTokenAccount);
    let _customerTokenAccount = await mint.getAccountInfo(customerTokenAccount);
    assert.ok(_merchantTokenAccount.amount.toNumber() == amount);
    assert.ok(_customerTokenAccount.amount.toNumber() == amount * 8);
  });

  it("Customer purchases product then cancels purchase", async () => {
    const orderId = generateOrderId();
    const productEscrow = anchor.web3.Keypair.generate();
    const [_vault_account_pda, _vault_account_bump] = await getTokenVaultPDA(
      program,
      productId,
      orderId
    );
    const [_vault_authority_pda, _vault_authority_bump] =
      await getProductEscrowPDA(program);
    await purchaseProductInstruction(
      program,
      orderId,
      productId,
      price,
      _vault_account_pda,
      _vault_account_bump,
      mint,
      customerMainAccount,
      customerTokenAccount,
      merchantMainAccount.publicKey,
      merchantTokenAccount,
      productEscrow
    );
    await cancelPurchaseInstruction(
      program,
      _vault_account_pda,
      _vault_authority_pda,
      customerMainAccount,
      customerTokenAccount,
      productEscrow
    );
    let _productEscrow = await program.account.productEscrow.fetch(
      productEscrow.publicKey
    );
    assert.ok(_productEscrow.delivered == false);
    assert.ok(_productEscrow.refunded == false);
    assert.ok(_productEscrow.cancelled == true);
    const _customerTokenAccount = await mint.getAccountInfo(
      customerTokenAccount
    );
    assert.ok(
      _customerTokenAccount.owner.equals(customerMainAccount.publicKey)
    );
    assert.ok(_customerTokenAccount.amount.toNumber() == amount * 8);
  });

  it("Customer purchases product, merchant refunds purchase", async () => {
    const orderId = generateOrderId();
    const productEscrow = anchor.web3.Keypair.generate();
    const [_vault_account_pda, _vault_account_bump] = await getTokenVaultPDA(
      program,
      productId,
      orderId
    );
    const [_vault_authority_pda, _vault_authority_bump] =
      await getProductEscrowPDA(program);
    await purchaseProductInstruction(
      program,
      orderId,
      productId,
      price,
      _vault_account_pda,
      _vault_account_bump,
      mint,
      customerMainAccount,
      customerTokenAccount,
      merchantMainAccount.publicKey,
      merchantTokenAccount,
      productEscrow
    );
    var _customerTokenAccount = await mint.getAccountInfo(customerTokenAccount);
    assert.ok(_customerTokenAccount.amount.toNumber() == amount * 7);
    await refundPurchaseInstruction(
      program,
      _vault_account_pda,
      _vault_authority_pda,
      customerMainAccount,
      customerTokenAccount,
      productEscrow
    );
    _customerTokenAccount = await mint.getAccountInfo(customerTokenAccount);
    assert.ok(_customerTokenAccount.amount.toNumber() == amount * 8);
    let _productEscrow = await program.account.productEscrow.fetch(
      productEscrow.publicKey
    );
    assert.ok(_productEscrow.delivered == false);
    assert.ok(_productEscrow.refunded == true);
    assert.ok(_productEscrow.cancelled == false);
  });

  it("Customer purchases product, merchant delivers, then customer cannot cancel purchase", async () => {
    const orderId = generateOrderId();
    const productEscrow = anchor.web3.Keypair.generate();
    const [_vault_account_pda, _vault_account_bump] = await getTokenVaultPDA(
      program,
      productId,
      orderId
    );
    const [_vault_authority_pda, _vault_authority_bump] =
      await getProductEscrowPDA(program);
    await purchaseProductInstruction(
      program,
      orderId,
      productId,
      price,
      _vault_account_pda,
      _vault_account_bump,
      mint,
      customerMainAccount,
      customerTokenAccount,
      merchantMainAccount.publicKey,
      merchantTokenAccount,
      productEscrow
    );
    await deliverProductInstruction(
      program,
      _vault_account_pda,
      _vault_authority_pda,
      merchantMainAccount,
      merchantTokenAccount,
      customerMainAccount,
      productEscrow
    );
    expectThrowsAsync(
      async () =>
        cancelPurchaseInstruction(
          program,
          _vault_account_pda,
          _vault_authority_pda,
          customerMainAccount,
          customerTokenAccount,
          productEscrow
        ),
      null
    );
  });

  
});

const expectThrowsAsync = async (method, errorMessage) => {
  let error = null;
  try {
    await method();
  } catch (err) {
    error = err;
  }
  expect(error).to.be.an("Error");
  if (errorMessage) {
    expect(error.message).to.equal(errorMessage);
  }
};

const deserializeBN = (x: any): anchor.BN => {
  return new anchor.BN(x.toNumber());
};
