import React, { useEffect, useMemo, useState } from 'react';
import './App.css';
import Wallet from '@project-serum/sol-wallet-adapter';
import { Connection, SystemProgram, clusterApiUrl } from '@solana/web3.js';

function App() {
  const [logs, setLogs] = useState([]);
  function addLog(log) {
    setLogs((logs) => [...logs, log]);
  }

  const [network, setNetwork] = useState('');
  const [state, setState] = useState('');

  const connection = useMemo(() => new Connection(network), [network]);
  const [wallet] = useState(new Wallet());
  const [, setConnected] = useState(false);
  useEffect(() => {
    wallet.on('connect', () => {
      setConnected(true);
      addLog('Connected to wallet ' + wallet.publicKey.toBase58());
      wallet._sendRequest('wallet_getCluster').then(cluster => setNetwork(clusterApiUrl(cluster)))
      wallet._sendRequest('wallet_getState').then(setState)
    });
    wallet.on('disconnect', () => {
      setConnected(false);
      addLog('Disconnected from wallet');
    });
    return () => {
      wallet.disconnect();
    };
  }, [wallet]);

  async function signTransaction() {
    try {
      let transaction = SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: wallet.publicKey,
        lamports: 100,
      });
      addLog('Getting recent blockhash');
      transaction.recentBlockhash = (
        await connection.getRecentBlockhash()
      ).blockhash;
      addLog('Sending signature request to wallet');
      let signed = await wallet.signTransaction(transaction);
      addLog('Signed by EzDeFi: ' + JSON.stringify(signed.signatures));
    } catch (e) {
      console.warn(e);
      addLog('Error: ' + e.message);
    }
  }

  async function sendTransaction() {
    try {
      let transaction = SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: wallet.publicKey,
        lamports: 100,
      });
      addLog('Getting recent blockhash');
      transaction.recentBlockhash = (
        await connection.getRecentBlockhash()
      ).blockhash;
      addLog('Sending transaction request to wallet');
      let result = await wallet.sendTransaction(transaction);
      addLog('Sent ' + result);
    } catch (e) {
      console.warn(e);
      addLog('Error: ' + e.message);
    }
  }

  return (
    <div className="App">
      <h1>Wallet Adapter Demo</h1>
      {wallet.connected ? (
        <>
          <div>Wallet address: {wallet.publicKey.toBase58()}.</div>
          <div>Wallet state: {state}</div>
          <div>Network: {network}</div>
          <button onClick={signTransaction}>Sign</button>
          <button onClick={sendTransaction}>Send</button>
        </>
      ) : (
        <button onClick={() => wallet.connect()}>Connect</button>
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
