import React, { useEffect, useMemo, useState } from 'react';
import './App.css';
import Wallet from '@project-serum/sol-wallet-adapter';
import {
  Connection,
  SystemProgram,
  Transaction,
  clusterApiUrl,
} from '@solana/web3.js';

function toHex(buffer: Buffer) {
  return Array.prototype.map
    .call(buffer, (x: number) => ('00' + x.toString(16)).slice(-2))
    .join('');
}

function App(): React.ReactElement {
  const [logs, setLogs] = useState<string[]>([]);
  function addLog(log: string) {
    setLogs((logs) => [...logs, log]);
  }

  const network = clusterApiUrl('devnet');
  const [providerUrl, setProviderUrl] = useState('https://www.sollet.io');
  const connection = useMemo(() => new Connection(network), [network]);
  const urlWallet = useMemo(
    () => new Wallet(providerUrl, network),
    [providerUrl, network],
  );
  const injectedWallet = useMemo(() => {
    try {
      return new Wallet(
        (window as unknown as { solana: unknown }).solana,
        network,
      );
    } catch (e) {
      console.log(`Could not create injected wallet`, e);
      return null;
    }
  }, [network]);
  const [selectedWallet, setSelectedWallet] = useState<
    Wallet | undefined | null
  >(undefined);
  const [, setConnected] = useState(false);
  useEffect(() => {
    if (selectedWallet) {
      selectedWallet.on('connect', () => {
        setConnected(true);
        addLog(
          `Connected to wallet ${selectedWallet.publicKey?.toBase58() ?? '--'}`,
        );
      });
      selectedWallet.on('disconnect', () => {
        setConnected(false);
        addLog('Disconnected from wallet');
      });
      void selectedWallet.connect();
      return () => {
        void selectedWallet.disconnect();
      };
    }
  }, [selectedWallet]);

  async function sendTransaction() {
    try {
      const pubkey = selectedWallet?.publicKey;
      if (!pubkey || !selectedWallet) {
        throw new Error('wallet not connected');
      }
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: pubkey,
          toPubkey: pubkey,
          lamports: 100,
        }),
      );
      addLog('Getting recent blockhash');
      transaction.recentBlockhash = (
        await connection.getRecentBlockhash()
      ).blockhash;
      addLog('Sending signature request to wallet');
      transaction.feePayer = pubkey;
      const signed = await selectedWallet.signTransaction(transaction);
      addLog('Got signature, submitting transaction');
      const signature = await connection.sendRawTransaction(signed.serialize());
      addLog('Submitted transaction ' + signature + ', awaiting confirmation');
      await connection.confirmTransaction(signature, 'singleGossip');
      addLog('Transaction ' + signature + ' confirmed');
    } catch (e) {
      console.warn(e);
      addLog(`Error: ${(e as Error).message}`);
    }
  }

  async function signMessage() {
    try {
      if (!selectedWallet) {
        throw new Error('wallet not connected');
      }
      const message =
        'Please sign this message for proof of address ownership.';
      addLog('Sending message signature request to wallet');
      const data = new TextEncoder().encode(message);
      const signed = await selectedWallet.sign(data, 'hex');
      addLog('Got signature: ' + toHex(signed.signature));
    } catch (e) {
      console.warn(e);
      addLog(`Error: ${(e as Error).message}`);
    }
  }

  return (
    <div className="App">
      <h1>Wallet Adapter Demo</h1>
      <div>Network: {network}</div>
      <div>
        Waller provider:{' '}
        <input
          type="text"
          value={providerUrl}
          onChange={(e) => setProviderUrl(e.target.value.trim())}
        />
      </div>
      {selectedWallet && selectedWallet.connected ? (
        <div>
          <div>Wallet address: {selectedWallet.publicKey?.toBase58()}.</div>
          <button onClick={sendTransaction}>Send Transaction</button>
          <button onClick={signMessage}>Sign Message</button>
          <button onClick={() => selectedWallet.disconnect()}>
            Disconnect
          </button>
        </div>
      ) : (
        <div>
          <button onClick={() => setSelectedWallet(urlWallet)}>
            Connect to Wallet
          </button>
          <button onClick={() => setSelectedWallet(injectedWallet)}>
            Connect to Injected Wallet
          </button>
        </div>
      )}
      <hr />
      <div className="logs">
        {logs.map((log, i) => (
          <div key={i}>{log}</div>
        ))}
      </div>
    </div>
  );
}

export default App;
