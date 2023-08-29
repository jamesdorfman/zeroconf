/* tslint:disable */
/* eslint-disable */
/**
* Create a segwit bond and address.
*
* Input:
* - `pubkey`: public key in hex that will commit to the bond
* - `bond_value`: value in sats
* - `bond_asset`: asset id in hex, or "lbtc"
* - `lock_time_unix`: locktime as a unix timestamp (like block timestamps)
* - `reclaim_pubkey`: public key in hex to be used for reclaiming the bond
*
* Output is the same as the [bond_inspect] function.
* @param {string} pubkey
* @param {bigint} bond_value_sat
* @param {string} bond_asset
* @param {bigint} lock_time_unix
* @param {string} reclaim_pubkey
* @returns {string}
*/
export function create_segwit_bond_spec(pubkey: string, bond_value_sat: bigint, bond_asset: string, lock_time_unix: bigint, reclaim_pubkey: string): string;
/**
* Inspect a base64-encoded bond spec.
*
* Input:
* - `spec`: the base64 bond spec
*
* Output: object with following fields:
* - `type`: bond type
* - `pubkey`: public key holding the bond
* - `bond_value`: the value in satoshi
* - `bond_asset`: the asset ID
* - `lock_time`: the locktime of the expiry
* - `reclaim_pubkey`: the reclaim pubkey
* - `script_pubkey`: the script pubkey for the bond address
* - `witness_script`: the witness script used for the address
* @param {string} spec
* @returns {any}
*/
export function inspect_bond(spec: string): any;
/**
* Create a Liquid/Elements address for the bond, given the spec.
*
* Input:
* - `spec`: the base64 encoded bond spec
* - `network`: "liquid", "liquidtestnet" or "elements"
*
* Output: a Liquid/Elements address
* @param {string} spec
* @param {string} network
* @returns {string}
*/
export function bond_address(spec: string, network: string): string;
/**
* Create a Bitcoin UTXO object to use as function argument.
*
* Input:
* - `tx`: the raw tx in hex
* - `vout`: the output index of the utxo
*
* Output: a [BitcoinUtxo] object
* @param {string} tx
* @param {number} vout
* @returns {any}
*/
export function create_bitcoin_utxo(tx: string, vout: number): any;
/**
* Create an Elements/Liquid UTXO object to use as function argument.
*
* Input:
* - `tx`: the raw tx in hex
* - `vout`: the output index of the utxo
*
* Output: a [ElementsUtxo] object
* @param {string} tx
* @param {number} vout
* @returns {any}
*/
export function create_elements_utxo(tx: string, vout: number): any;
/**
* Create a transaction to burn a bond.
*
* Input:
* - `bond_utxo`: the Elements/Liquid UTXO outpoint, as `<txid>:<vout>`
* - `bond_tx`: the raw hex bond transaction
* - `spec_base64`: bond spec encoded as base64
* - `double_spend_utxo`: the Bitcoin UTXO outpoint that was double spent, as `<txid>:<vout>`
* - `double_spend_tx`: the Bitcoin tx that was double spent
* - `tx1_hex`: first double spend Bitcoin tx in hex
* - `tx2_hex`: second double spend Bitcoin tx in hex
* - `fee_rate_sat_per_vb`: the fee rate to use in satoshi per virtual byte
* - `reward_address`: the reward Elements/Liquid address where to send the reward
*
* Output: an Elements/Liquid transaction in hex
* @param {string} bond_utxo
* @param {string} bond_tx
* @param {string} spec_base64
* @param {string} double_spend_utxo
* @param {string} double_spend_tx
* @param {string} tx1_hex
* @param {string} tx2_hex
* @param {bigint} fee_rate_sat_per_vb
* @param {string} reward_address
* @returns {string}
*/
export function create_burn_tx(bond_utxo: string, bond_tx: string, spec_base64: string, double_spend_utxo: string, double_spend_tx: string, tx1_hex: string, tx2_hex: string, fee_rate_sat_per_vb: bigint, reward_address: string): string;
/**
* Create a transaction to reclaim a bond after it has expired.
*
* Input:
* - `bond_utxo`: the Elements/Liquid UTXO outpoint, as `<txid>:<vout>`
* - `bond_tx`: the raw hex bond transaction
* - `spec_base64`: bond spec encoded as base64
* - `fee_rate_sat_per_vb`: the fee rate to use in satoshi per virtual byte
* - `reclaim_sk`: secret key of the reclaim pubkey in either WIF or hex
* - `claim_address`: the claim Elements/Liquid address where to send the funds
*
* Output: an Elements/Liquid transaction in hex
* @param {string} bond_utxo
* @param {string} bond_tx
* @param {string} spec_base64
* @param {bigint} fee_rate_sat_per_vb
* @param {string} reclaim_sk
* @param {string} claim_address
* @returns {string}
*/
export function create_reclaim_tx(bond_utxo: string, bond_tx: string, spec_base64: string, fee_rate_sat_per_vb: bigint, reclaim_sk: string, claim_address: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly create_segwit_bond_spec: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => void;
  readonly inspect_bond: (a: number, b: number, c: number) => void;
  readonly bond_address: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly create_bitcoin_utxo: (a: number, b: number, c: number, d: number) => void;
  readonly create_elements_utxo: (a: number, b: number, c: number, d: number) => void;
  readonly create_burn_tx: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number, q: number, r: number) => void;
  readonly create_reclaim_tx: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) => void;
  readonly rustsecp256k1zkp_v0_8_0_default_illegal_callback_fn: (a: number, b: number) => void;
  readonly rustsecp256k1zkp_v0_8_0_default_error_callback_fn: (a: number, b: number) => void;
  readonly rustsecp256k1_v0_8_1_context_create: (a: number) => number;
  readonly rustsecp256k1_v0_8_1_context_destroy: (a: number) => void;
  readonly rustsecp256k1_v0_8_1_default_illegal_callback_fn: (a: number, b: number) => void;
  readonly rustsecp256k1_v0_8_1_default_error_callback_fn: (a: number, b: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_exn_store: (a: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {SyncInitInput} module
*
* @returns {InitOutput}
*/
export function initSync(module: SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {InitInput | Promise<InitInput>} module_or_path
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: InitInput | Promise<InitInput>): Promise<InitOutput>;
