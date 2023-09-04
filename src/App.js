import { useState } from 'react';
import init, {
  create_segwit_bond_spec,
  bond_address,
  inspect_bond,
  create_burn_tx,
} from "doubletake"
import { detectProvider } from 'marina-provider';
import { Transaction } from 'bitcoinjs-lib';
import wally from 'wallycore';

import {
  date_to_unix_timestamp,
  unix_timestamp_to_date,
  sat_to_btc
} from './util.js';

import questionmark from "./img/questionmark.png"

// The following line is needed to instruct the ES6 linter:
/* global BigInt */

const NETWORK = "liquidtestnet"; // options: liquidtestnet, liquid,

const EXPLORER_URL = {
  "liquidtestnet": "https://blockstream.info/liquidtestnet/",
  "bitcoin": "https://blockstream.info/",
}

const getLBTCAsset = () => {
  if (NETWORK == "liquidtestnet") {
    return "144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49";
  } else if (NETWORK == "liquid") {
    return "b2e15d0d7a0c94e4e2ce0fe6e8691b9e451377f6e46e8045a86f7c4b5d4f0f23";
  } else {
    console.error("Unrecognized network");
    return "ERROR"
  }
}

const assetToEnglish = (asset) => {
  if (asset == "144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49") {
    return "tL-BTC";
  } else if (asset == "b2e15d0d7a0c94e4e2ce0fe6e8691b9e451377f6e46e8045a86f7c4b5d4f0f23") {
    return "L-BTC";
  } else {
    return "unknown";
  }
}

const BITCOIN_PK_TOOLTIP = "The Bitcoin public key which you want to send zero-conf transactions from";
const BURN_AMT_TOOLTIP = "The " + assetToEnglish(getLBTCAsset()) + " amount which will be burned if a double spend is submitted from the Bitcoin public key";
const REWARD_AMT_TOOLTIP = "The extra amount included in the bond which will be used to pay for the fee if the bond is burned. Recommended: at least 10 000 sats.";
const EXPIRY_DATE_TOOLTIP = "On this date, you will be able to reclaim the funds tied up in your bond using this browser's marina wallet. In other words, this is the date when your bond expires. Make sure to backup your marina wallet, or else you will lose access to these funds.";

const BOND_SPEC_TOOLTIP = "The Base64 spec string which the sender gave you to prove the existence of their bond";
const WHY_BURN_TOOLTIP = "If the funds were sent to the claimer, then the double spender would be able to claim their own bond. Burning the funds ensures that the bond creator cannot exploit the bond and save their funds when they perform a double spend."

const TX1_HEX_TOOLTIP = "The raw Bitcoin transaction (hex) of one of the two double spend transactions from the bond's Bitcoin public key";
const TX2_HEX_TOOLTIP = "The raw Bitcoin transaction (hex) of the other of the two double spend transactions from the bond's Bitcoin public key";
const REWARD_ADDRESS_TOOLTIP = "If any excess funds remain in the bond after the burn then they will be sent to this address. If this field left blank then they any reward funds will simply be sent to your browser's marina wallet.";

// FORM VALIDATION
function validateBitcoinPubkey(pubkey) {
  return pubkey.length > 0 && pubkey.length == (33 * 2);
}
function validateRewardAmt(amt) {
  return amt.length > 0 && !isNaN(amt);
}
function validateBurnAmt(amt) {
  return amt.length > 0 && !isNaN(amt);
}
function validateExpiryDate(expiryDate) {
  return expiryDate.length > 0
    && !isNaN(date_to_unix_timestamp(expiryDate));
}
function validateBondSpec(spec) {
  return spec.length > 25 && spec.length < 500;
}
function validateTxHex(hex) {
  return hex.length > 0;
}

async function fetch_bitcoin_double_spend_utxo(tx_1_hex, tx_2_hex) {
  var tx1 = Transaction.fromHex(tx_1_hex);
  var tx2 = Transaction.fromHex(tx_2_hex);

  var tx2_tmp = Transaction.fromHex(tx_2_hex); // fixme: not sure how to properly clone the hash field

  let in_to_outpoint = (input) => {
    return input.hash.reverse().toString('hex') + ":" + input.index
  }
  let tx1_outpoints = tx1.clone().ins.map(in_to_outpoint); // todo: make a set not a list
  let matching_tx2_input_idx = tx2_tmp.ins.findIndex((input) => {
    return tx1_outpoints.includes(in_to_outpoint(input));
  });
  if (matching_tx2_input_idx == undefined) { // todo: is this correct syntax?
    console.error("inputted txs had no matching input"); // todo: return false after this
    return null;
  }
  let matching_tx2_input = tx2.ins[matching_tx2_input_idx];

  let matching_outpoint = in_to_outpoint(matching_tx2_input);
  let [txid, vout] = matching_outpoint.split(':');
  var hex = "";

  let URL_1 = EXPLORER_URL["bitcoin"] + "api/tx/" + txid + "/hex";
  let response = await fetch(URL_1);
  if (response.ok) {
    hex = await response.text()
  } else {
    console.error('Error occured when fetching transaction');
  }
  console.log(hex);

  return [hex, txid, vout];
}

async function bond_address_to_txid(address) {
  let URL = EXPLORER_URL[NETWORK] + "api/address/" + address + "/txs";
  let response = await fetch(URL);
  console.log(response);
  if (response.ok) {
    let json = await response.json();
    if (json.length != 1) {
      console.error("Unexpected response from UTXO explorer query. Expected 1 tx, got: " + json.length);
    } // TODO: how do we handle multiple txs to same addres
    let txid = json[json.length - 1]['txid']; // take oldest tx
    if (txid == undefined) {
      console.error("Invalid txid");
      return "";
    } else {
      return txid;
    }
  } else {
    console.error("Unable to fetch bond utxo")
  }
}

async function bond_txid_to_tx(txid) {
  let URL = EXPLORER_URL[NETWORK] + "api/tx/" + txid + "/hex";
  let response = await fetch(URL);
  if (response.ok) {
    return response.text()
  }
  return null;
}

async function bond_txid_to_vout(txid, address) {
  let URL = EXPLORER_URL[NETWORK] + "api/tx/" + txid;
  let response = await fetch(URL);
  if (response.ok) {
    let json = await response.json();
    console.log(json);
    let vouts = json['vout'];
    if (vouts.length != 3) {
      // 1 for burn, 1 for reward, 1 for fee
      return null;
    }
    console.log(vouts);
    console.log(address);
    let vout = vouts.findIndex((vout) => vout['scriptpubkey_address'] == address);
    if (vout == -1) { // todo: double check this syntax
      console.error("Unable to find bond vout");
      return null;
    }
    return vout;
  }
}

async function bond_txid_to_utxo(txid, address) {
  let URL = EXPLORER_URL[NETWORK] + "api/tx/" + txid;
  let response = await fetch(URL);
  if (response.ok) {
    let json = await response.json();
    console.log(json);
    let vouts = json['vout'];
    if (vouts.length != 3) {
      // 1 for burn, 1 for reward, 1 for fee
      return null;
    }
    let vout = vouts.find((vout) => vout['scriptpubkey_address'] == address);
    if (vout == -1) { // todo: double check this syntax
      console.error("Unable to find bond vout");
      return null;
    }
    return vout;
  }
}

function toHexString(byteArray) {
  return Array.from(byteArray, function(byte) {
    return ('0' + (byte & 0xFF).toString(16)).slice(-2);
  }).join('')
}

async function getPublicKey(address) {
  const marina = window.marina; // window.marina
  if (!marina) throw new Error('No Marina provider found')
  // get the account master public key (the hardened part of the path)
  const { masterXPub } = await marina.getAccountInfo(
    address.accountName,
  )

  if (!address.derivationPath) {
    throw new Error(
      'unable to find derivation path used by Marina to generate borrowerPublicKey',
    )
  }

  const bkey = wally.bip32_key_from_base58(masterXPub);
  let children = address.derivationPath.replace('m/', '').split('/');
  if (children.length != 2) {
    console.error("Unexpected derivation path from marina");
    return false;
  };
  var key1 = wally.bip32_key_from_parent(bkey, Number(children[0]), wally.BIP32_FLAG_KEY_PUBLIC);
  var key2 = wally.bip32_key_from_parent(key1, Number(children[1]), wally.BIP32_FLAG_KEY_PUBLIC);
  let pubkey = wally.bip32_key_get_pub_key(key2);

  console.log(masterXPub);
  console.log(address.derivationPath);
  console.log(toHexString(pubkey))

  window.marina.getCoins().then((x) => console.log(x));
  console.log(window.marina.getBalances())

  return toHexString(pubkey);
}

const submitTxClick = async (liquidAddr, totalAmt) => {
  const { txid, hex } = await window.marina.sendTransaction(
    [
      {
        address: liquidAddr, // the address of the recipient
        asset: getLBTCAsset(), // the asset to send
        value: totalAmt // amount always expressed in satoshis
      } // todo: pass in totalAmt as value
    ],
  );

  console.log(txid, hex)
}

function Footer() {
  return(
    <footer>
      {/*<p>A project by <a href="http://twitter.com/james_dev_123">James Dorfman</a> and <a href="https://roose.io/">Steven Roose</a></p>*/}
    </footer>
  )
}

function Content() {

  const [activePage, setActivePage] = useState("verifyPage");
  const [isGenerateSubmitted, setIsGenerateSubmitted] = useState(false);
  const [isVerifySubmitted, setIsVerifySubmitted] = useState(false);
  const [isClaimSubmitted, setIsClaimSubmitted] = useState(false);

  const [bitcoinPubkey, setBitcoinPubkey] = useState('');
  const [burnAmt, setBurnAmt] = useState(''); // TODO: fixme
  const [rewardAmt, setRewardAmt] = useState('10000'); // default fee
  const [expiryDate, setExpiryDate] = useState('');

  const [liquidAddr, setLiquidAddr] = useState('');
  const [liquidSpec, setLiquidSpec] = useState('');

  const [bondSpec, setBondSpec] = useState('');
  const [bondJson, setBondJson] = useState({});

  const [tx1Hex, setTx1Hex] = useState('');
  const [tx2Hex, setTx2Hex] = useState('');
  const [liquidBurnTx, setLiquidBurnTx] = useState('');
  const [rewardAddress, setRewardAddress] = useState('');
  const [broadcastStatus, setBroadcastStatus] = useState('');

  const generateBondClick = async (
    bitcoin_pubkey,
    bond_value,
    lock_time_unix,
  ) => {
    try {
      await window.marina.enable();

      let pubkey = bitcoin_pubkey;
      let value = BigInt(bond_value);
      let bond_asset = getLBTCAsset();
      let time = BigInt(lock_time_unix);
      console.log("Submitting time " + time);

      let nextAddr = await window.marina.getNextAddress()
      let reclaim_pubkey = await getPublicKey(nextAddr);

      await init();
      const spec = create_segwit_bond_spec(
        pubkey,
        value,
        bond_asset,
        time,
        reclaim_pubkey
      );

      const address = await bond_address(
        spec,
        NETWORK,
      );

      // TODO: handle error
      setLiquidAddr(address);
      setLiquidSpec(spec);
    } catch (err) {
      console.error("Error occurred while generating bond: " + err);
      alert(err);
    }

    // Scroll so that new spec comes into view
    setTimeout(function(){
      let newSpec = document.getElementById('newSpec');
      newSpec.scrollIntoView({behavior:"smooth"});
    }, 500);
  }

  const fetchBond = async (
    spec,
  ) => {
    try {
      await init();
      const bond_map = inspect_bond(
        spec
      );
      const bond_json = Object.fromEntries(bond_map);
      console.log(bond_json);
      console.log("done");
      // TODO: handle error
      if ('bond_value' in bond_json) {
        bond_json['address'] = bond_address(spec, NETWORK);
        bond_json['txid'] = await bond_address_to_txid(bond_json['address']);
        bond_json['utxo'] = await bond_txid_to_utxo(bond_json['txid'], bond_json['address']);
        bond_json['reward_amt'] = bond_json['utxo']['value'] - bond_json['bond_value'];
        setBondJson(bond_json);
      } else {
        console.error('invalid bond');
      }
    } catch (err) {
      console.error("Error occurred while fetching bond " + err);
      alert(err);
    }
  }

  const claimBond = async (
    spec,
    tx1_hex,
    tx2_hex,
    reward_address,
  ) => {
    try {
      await init();
      const address = await bond_address(spec, NETWORK);
      const bond_lq_txid = await bond_address_to_txid(address);
      const bond_lq_vout = await bond_txid_to_vout(bond_lq_txid, address);
      const bond_lq_raw_tx = await bond_txid_to_tx(bond_lq_txid);

      const [double_spend_tx_hex, double_spend_utxo_txid, double_spend_utxo_vout] = await fetch_bitcoin_double_spend_utxo(tx1_hex, tx2_hex);

      if (reward_address.length === 0) { // fetch from marina
        let next_address = await window.marina.getNextAddress(); // TODO: should this be confidential?
        reward_address = next_address.confidentialAddress;
      }
      console.log("Reward address: " + reward_address);

      let lq_burn_tx = await create_burn_tx(
        bond_lq_txid + ":" + bond_lq_vout,
        bond_lq_raw_tx,
        spec,
        double_spend_utxo_txid + ":" + double_spend_utxo_vout,
        double_spend_tx_hex,
        tx1_hex,
        tx2_hex,
        BigInt(1), // liquid network sats / vbyte (hardcoded for now)
        reward_address,
      );

      console.log(lq_burn_tx);

      setLiquidBurnTx(lq_burn_tx);
    } catch (err) {
      console.error("Error occurred while claiming bond " + err);
      alert(err);
    }

    // Scroll down so that new tx comes into view
    setTimeout(function(){
      let holder = document.getElementById('burn-tx-holder');
      holder.scrollIntoView({behavior:"smooth"});
    }, 500);
  }

  async function broadcastRawTx(liquidBurnTx) {
    let URL = EXPLORER_URL[NETWORK] + "api/tx";
    console.log(liquidBurnTx)
    let response = await fetch(URL, {
      method: "POST",
      body: liquidBurnTx,
      mode: "no-cors", // no-cors, *cors, same-origin
    });
    if (!response.ok) {
      console.error("Blockstream explorer API raw tx broadcast failed");
      setBroadcastStatus("Error broadcasting transaction");
      console.log('Set it');
      console.log(await response.text());
      //setBroadcastStatus(await response.text());
    }
  }

  const getTotalAmt = () => {
    // user must send this much to the bond
    return Number(burnAmt) + Number(rewardAmt);
  }

  return (
    <>
    <div id="top-text">
      <h1>zeroconf.me</h1>
      <h3>A (beta) project by <a href="http://twitter.com/james_dev_123">James Dorfman</a> and <a href="https://roose.io/">Steven Roose</a></h3>
      <h4>Disclaimer: only currently working on Liquid testnet and with Google Chrome</h4>
      <h2>Show users they can safely accept zero-conf transactions from your Bitcoin public key</h2>
      <h2>For more details, see <a href="https://roose.io/blog/bitcoin-double-spend-prevention-bonds-liquid/">this blog post</a></h2>
    </div>
    <div id="nav">
      <div className={`${activePage === "generatePage" ? 'activeNav' : ''}`}>
        <button onClick={() => setActivePage("generatePage")}>Generate Bond</button>
      </div>
      <div className={`${activePage === "verifyPage" ? 'activeNav' : ''}`}>
        <button onClick={() => setActivePage("verifyPage")}>Verify a Bond</button>
      </div>
      <div className={`${activePage === "claimPage" ? 'activeNav' : ''}`}>
        <button onClick={() => setActivePage("claimPage")}>Burn a Bond</button>
      </div>
    </div>
    <div className={`${activePage === "generatePage" ? '' : 'invisible'} content`}>
      <div id="instructions">
        <img id="questionmark" src={questionmark}></img>
        <p>Generate a bond on Liquid with funds that will be burned if you do a Bitcoin double spend. This will assure your customers that they can accept your zero-conf transactions.</p>
      </div>
        <label for="bitcoin-pubkey">Bitcoin Public Key <div class="tooltip">(?) <span class="tooltiptext">{BITCOIN_PK_TOOLTIP}</span></div></label><br/>
        <input
          type="text"
          placeholder="000000000000000000000000000000000000000000000000000000"
          value={bitcoinPubkey}
          className={!validateBitcoinPubkey(bitcoinPubkey) && isGenerateSubmitted ? 'error-input bitcoin-pubkey' : 'bitcoin-pubkey'}
          onChange={(e) =>
            setBitcoinPubkey(e.target.value)
          }/><br/>
      <div class="form-row">
        <div id="left">
          <div class="form-group">
            <label for="burn-amt">Burn Amount (sats) <div class="tooltip">(?) <span class="tooltiptext">{BURN_AMT_TOOLTIP}</span></div></label><br/>
            <input
              type="text"
              id="burn-amt"
              placeholder="XXX"
              value={burnAmt}
              className={!validateBurnAmt(burnAmt) && isGenerateSubmitted ? 'error-input' : ''}
              onChange={(e) =>
                setBurnAmt(e.target.value)
              }/><br/>
          </div>
          <div class="form-group">
            <label for="reward-amt">Fee budget (sats) <div class="tooltip">(?) <span class="tooltiptext">{REWARD_AMT_TOOLTIP}</span></div></label><br/>
            <input
              type="text"
              id="reward-amt"
              placeholder="YYY sats"
              value={rewardAmt}
              className={!validateRewardAmt(rewardAmt) && isGenerateSubmitted ? 'error-input' : ''}
              onChange={(e) =>
                setRewardAmt(e.target.value)
              }/><br/>
          </div>
        </div>
        <div id="right">
          <div id="amt-hint">
            <u> </u>
          </div>
        </div>
      </div>
      <label for="Expiry Date">Expiry Date <div class="tooltip">(?) <span class="tooltiptext">{EXPIRY_DATE_TOOLTIP}</span></div></label><br/>
      <input
        type="text"
        placeholder="Apr 21, 2024"
        id="expiry-date"
        value={expiryDate}
        className={!validateExpiryDate(expiryDate) && isGenerateSubmitted ? 'error-input' : ''}
        onChange={(e) =>
          setExpiryDate(e.target.value)
        }/><br/>
      <button class="generate-btn" onClick={() => {
            setIsGenerateSubmitted(true);
            if (!validateBitcoinPubkey(bitcoinPubkey)) return;
            if (!validateBurnAmt(burnAmt)) return;
            if (!validateRewardAmt(rewardAmt)) return;
            if (!validateExpiryDate(expiryDate)) return;

            generateBondClick(bitcoinPubkey, burnAmt, date_to_unix_timestamp(expiryDate))
          }
        }>Generate Bond</button><br/>


      <div id="thin-line" className={`${liquidAddr != "" ? 'visible' : 'invisible'}`}></div>

      <div id="newSpec" className={`${liquidAddr != "" ? 'visible' : ''}`}>
        <p>Send exactly {getTotalAmt()} { NETWORK === "liquidtestnet" ? "t" : "" }L-BTC to the following Liquid address</p>
        <p id='addr'>{liquidAddr}</p><br/>
        <button id="send-tx-btn" onClick={() => {
            submitTxClick(liquidAddr, getTotalAmt())
          }
        }>Send funds from Marina</button><br/>
        <p>Save this spec. You will need to share it with receivers:</p>
        <p id="spec">{liquidSpec}</p><br/>
      </div>

      {Footer()}
    </div>

    <div className={`${activePage === "verifyPage" ? '' : 'invisible'} content`}>
      <div id="instructions">
        <img id="questionmark" src={questionmark}></img>
        <p>Verify a bond that was created using this tool</p>
      </div>
        <label for="bond-spec">Bond Spec <div class="tooltip">(?) <span class="tooltiptext">{BOND_SPEC_TOOLTIP}</span></div></label><br/>
        <textarea
          type="text"
          id="bond-spec"
          className={isVerifySubmitted && Object.keys(bondJson).length == 0 ? 'error-input' : ''}
          placeholder="AAJ3g-LB9mTsyVrYMd8J3pvnvnJOmrOHmgSRWOD4X781hQUAAAAAAAAASZqBhUX2uuOfwDtjfypOHmTlkMrBvDpvbXGqRENlTBQ-R6lmA_aRqTBUWGqg4rd1nDvwUGVGPGfpeTCwkJk91GVSTcsH"
          value={bondSpec}
          onChange={(e) =>
            setBondSpec(e.target.value.trim())
          }/><br/>

        <button class="generate-btn" onClick={() => {
            setIsVerifySubmitted(true);
            if (!validateBondSpec(bondSpec)) return;

            fetchBond(bondSpec)
          }
        }>Fetch Bond</button>

        <div className={`${Object.entries(bondJson).length === 0 ? 'invisible' : 'visible'}`} id="spec-info">
          <p><b>Bitcoin pubkey:</b> {bondJson.pubkey}</p>
          <p><b>Burn value:</b> {sat_to_btc(bondJson.bond_value)} {assetToEnglish(bondJson.bond_asset)}</p>
          <p><b>Included fee budget:</b> {sat_to_btc(bondJson.reward_amt)} {assetToEnglish(bondJson.bond_asset)}</p>
          <p><b>Expiry:</b> {unix_timestamp_to_date(bondJson.lock_time)}</p>
          <p><b>Bond TXID:</b> <a href={EXPLORER_URL[NETWORK] + "tx/" + bondJson.txid}>{bondJson.txid}</a></p>

          <p>Anyone who can show a double spend from this bitcoin public key can burn
            &nbsp;{sat_to_btc(bondJson.bond_value)} {assetToEnglish(bondJson.bond_asset)} of the owner's
            funds
          </p>
          <div id="burn-explained">
            <u><div class="tooltip">Why is the bond burned (?)<span class="tooltiptext burn-tooltip">{WHY_BURN_TOOLTIP}</span></div></u>
          </div>
          <br></br>
        </div>

        {Footer()}
    </div>

    <div className={`${activePage === "claimPage" ? '' : 'invisible'} content`}>
      <div id="instructions">
        <img id="questionmark" src={questionmark}></img>
        <p>Burn a bond that was created using this tool by providing a double spend from the associated Bitcoin public key
        </p>
      </div>

      <label for="bitcoin-pubkey">Liquid Bond Spec <div class="tooltip">(?) <span class="tooltiptext">{BOND_SPEC_TOOLTIP}</span></div></label><br/>
      <textarea
          type="text"
          id="bond-spec"
          className={!validateBondSpec(bondSpec) && isClaimSubmitted ? 'error-input' : ''}
          placeholder="AAJ3g-LB9mTsyVrYMd8J3pvnvnJOmrOHmgSRWOD4X781hQUAAAAAAAAASZqBhUX2uuOfwDtjfypOHmTlkMrBvDpvbXGqRENlTBQ-R6lmA_aRqTBUWGqg4rd1nDvwUGVGPGfpeTCwkJk91GVSTcsH"
          value={bondSpec}
          onChange={(e) =>
            setBondSpec(e.target.value.trim())
          }/><br/>

      <label for="bitcoin-pubkey">Bitcoin transaction #1 hex <div class="tooltip">(?) <span class="tooltiptext">{TX1_HEX_TOOLTIP}</span></div></label><br/>
      <textarea
        type="text"
        className={!validateTxHex(tx1Hex) && isClaimSubmitted ? 'error-input tx-hex' : 'tx-hex'}
        placeholder="020000000001015b69cc9bbba01419b2a9e5644ec82f0e1101626bc31db8aa1a1993fb1131e9960100000000fdffffff02dfb9ed00000000001600143938d4abd107e46d59a06d81cf96d6d60de9a5b8809fd5000000000016001422c31e2b606fc9e16496c91af15a4a2904dec4ab0247304402206a143fa19da7180716fbbebf3840eedfa7e101f71a6c47c9537c87d033269daa022063116fbfc8f39178f32670b2e0a7e10f9d9888134f20b22a36068668694e08e10121027783e2c1f664ecc95ad831df09de9be7be724e9ab3879a049158e0f85fbf35857b430c00"
        value={tx1Hex}
          onChange={(e) =>
            setTx1Hex(e.target.value.trim())
          }/><br/>

      <label for="bitcoin-pubkey">Bitcoin transaction #2 hex <div class="tooltip">(?) <span class="tooltiptext">{TX2_HEX_TOOLTIP}</span></div></label><br/>
      <textarea
        type="text"
        className={!validateTxHex(tx2Hex) && isClaimSubmitted ? 'error-input tx-hex' : 'tx-hex'}
        placeholder="020000000001015b69cc9bbba01419b2a9e5644ec82f0e1101626bc31db8aa1a1993fb1131e9960100000000fdffffff021fb9ed00000000001600143938d4abd107e46d59a06d81cf96d6d60de9a5b8809fd5000000000016001422c31e2b606fc9e16496c91af15a4a2904dec4ab024730440220402d11b26aad68497e8629fcb8e020f3440747fe67bada2f43c9afea3e6d7153022029a419ddaf06ae50d7211bef4752812b5f51c61c2f15121bab34792d3d9c56d40121027783e2c1f664ecc95ad831df09de9be7be724e9ab3879a049158e0f85fbf35857c430c00"
        value={tx2Hex}
          onChange={(e) =>
            setTx2Hex(e.target.value.trim())
          }/><br/>

      <label for="bitcoin-pubkey">Liquid Reward Address (optional) <div class="tooltip">(?) <span class="tooltiptext">{REWARD_ADDRESS_TOOLTIP}</span></div></label><br/>
      <input
        type="text"
        class="bitcoin-pubkey"
        placeholder=""
        value={rewardAddress}
          onChange={(e) =>
            setRewardAddress(e.target.value.trim())
          }/><br/>

      <button class="generate-btn" id="generate-claim-tx-btn" onClick={() => {
            setIsClaimSubmitted(true);
            if (!validateBondSpec(bondSpec)) return;
            if (!validateTxHex(tx1Hex)) return;
            if (!validateTxHex(tx2Hex)) return;

            claimBond(bondSpec, tx1Hex, tx2Hex, rewardAddress)
          }
        }>Generate Transaction</button>

      <div className={`${Object.entries(liquidBurnTx).length === 0 ? 'invisible' : 'visible'}`} id="burn-tx-holder">
        <p id="burn-tx">{liquidBurnTx}</p>

        <button class="generate-btn" id="send-claim-tx-btn" onClick={() => {
            broadcastRawTx(liquidBurnTx)
          }
        }>Broadcast on Liquid</button>

        <div className={`${broadcastStatus.length === 0 ? 'invisible' : 'visible'}`}
            id="broadcast-status"><b>Broadcast status:</b> {broadcastStatus}</div>
      </div>
    </div>
  </>
  );
}

const activateMarina = async () => {
  try {
  const marina = await detectProvider('marina');
  // now the window.marina provider is available for use!
  } catch (err) {
    alert("Please install the Marina Wallet chrome extension! Otherwise this webpage won't work.");
  }
}

function App() {
  activateMarina();

  return (
    Content(true, false, false)
  );
}

export default App;
