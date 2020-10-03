import React, { useEffect, useMemo, useState } from 'react';
import './App.css';
import Wallet from '@project-serum/sol-wallet-adapter';
import { Connection, SystemProgram, PublicKey, clusterApiUrl, Transaction } from '@solana/web3.js';
import bs58 from 'bs58';

function App() {
  const [logs, setLogs] = useState([]);
  function addLog(log) {
    setLogs((logs) => [...logs, log]);
  }
  const [signedResult, setSignedResult] = useState(null)

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
      addLog('Getting recent blockhash');
      const recentBlockhash = (await connection.getRecentBlockhash()).blockhash;
      const transaction = new Transaction({recentBlockhash})
        .add(SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: wallet.publicKey,
          lamports: 1e9,
        }))
      transaction.setSigners(wallet.publicKey)
      addLog('Sending signature request to wallet');
      let result = await wallet.signMessage(bs58.encode(transaction.serializeMessage()));
      transaction.addSignature(new PublicKey(result.publicKey), Buffer.from(bs58.decode(result.signature)));
      addLog('Signed by EzDeFi extension');
      setSignedResult(result)
    } catch (e) {
      console.warn(e);
      addLog('Error: ' + e.message);
    }
  }

  async function sendTransaction() {
    try {
      addLog('Getting recent blockhash');
      const recentBlockhash = (await connection.getRecentBlockhash()).blockhash;
      const tx = new Transaction({recentBlockhash})
        .add(SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: wallet.publicKey,
          lamports: '1.23e9',
        }))
      tx.setSigners(wallet.publicKey)
      addLog('Sending transaction request to wallet');
      const signature = await wallet.sendTransaction(tx);
      addLog('Sent ' + signature);
      await connection.confirmTransaction(signature, 1);
      addLog('Transaction ' + signature + ' confirmed');
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
      {signedResult && 
      <div className="signed-message">
        <textarea disabled={true} cols={72} rows={30} value={JSON.stringify(signedResult, undefined, 2)}/>
      </div>}
    </div>
  );
}

export default App;
