import EventEmitter from 'eventemitter3';
import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

export default class Wallet extends EventEmitter {
  constructor(providerUrl, network) {
    super();
    this._providerUrl = new URL(providerUrl);
    this._providerUrl.hash = new URLSearchParams({
      origin: window.location.origin,
      network,
    }).toString();
    this._publicKey = null;
    this._autoApprove = false;
    this._popup = null;
    this._handlerAdded = false;
    this._nextRequestId = 1;
    this._responsePromises = new Map();
    this._useInjectedInterface = false;
  }

  _handleMessage = (e) => {
    if (
      (this._useInjectedInterface && window.solana && e.source === window) ||
      (e.origin === this._providerUrl.origin && e.source === this._popup)
    ) {
      if (e.data.method === 'connected') {
        const newPublicKey = new PublicKey(e.data.params.publicKey);
        if (!this._publicKey || !this._publicKey.equals(newPublicKey)) {
          this._handleDisconnect();
          this._publicKey = newPublicKey;
          this._autoApprove = !!e.data.params.autoApprove;
          this.emit('connect', this._publicKey);
        }
      } else if (e.data.method === 'disconnected') {
        this._handleDisconnect();
      } else if (e.data.result || e.data.error) {
        if (this._responsePromises.has(e.data.id)) {
          const [resolve, reject] = this._responsePromises.get(e.data.id);
          if (e.data.result) {
            resolve(e.data.result);
          } else {
            reject(new Error(e.data.error));
          }
        }
      }
    }
  };

  _handleConnect = () => {
    if (this._useInjectedInterface && window.solana) {
      return new Promise((resolve) => {
        this._sendRequest('connect', {});
      });
    } else {
      window.name = 'parent';
      this._popup = window.open(
        this._providerUrl.toString(),
        '_blank',
        'location,resizable,width=460,height=675',
      );
      return new Promise((resolve) => {
        this.once('connect', resolve);
      });
    }
  };

  _handleDisconnect = () => {
    if (this._publicKey) {
      this._publicKey = null;
      this.emit('disconnect');
    }
    this._responsePromises.forEach(([resolve, reject], id) => {
      this._responsePromises.delete(id);
      reject('Wallet disconnected');
    });
  };

  _sendRequest = async (method, params) => {
    if (method !== 'connect' && !this.connected) {
      throw new Error('Wallet not connected');
    }
    const requestId = this._nextRequestId;
    ++this._nextRequestId;
    return new Promise((resolve, reject) => {
      this._responsePromises.set(requestId, [resolve, reject]);
      if (this._useInjectedInterface && window.solana) {
        window.solana.postMessage({
          jsonrpc: '2.0',
          id: requestId,
          method,
          params,
        });
      } else {
        this._popup.postMessage(
          {
            jsonrpc: '2.0',
            id: requestId,
            method,
            params,
          },
          this._providerUrl.origin,
        );

        if (!this.autoApprove) {
          this._popup.focus();
        }
      }
    });
  };

  get publicKey() {
    return this._publicKey;
  }

  get connected() {
    return this._publicKey !== null;
  }

  get autoApprove() {
    return this._autoApprove;
  }

  connect = () => {
    if (this._popup) {
      this._popup.close();
    }
    if (!this._handlerAdded) {
      this._handlerAdded = true;
      window.addEventListener('message', this._handleMessage);
      window.addEventListener('beforeunload', this.disconnect);
    }
    return this._handleConnect();
  };

  disconnect = () => {
    if (this._popup) {
      this._popup.close();
    }
    this._handleDisconnect();
  };

  signTransaction = async (transaction) => {
    const response = await this._sendRequest('signTransaction', {
      message: bs58.encode(transaction.serializeMessage()),
    });
    const signature = bs58.decode(response.signature);
    const publicKey = new PublicKey(response.publicKey);
    transaction.addSignature(publicKey, signature);
    return transaction;
  };

  signAllTransactions = async (transactions) => {
    const response = await this._sendRequest('signAllTransactions', {
      messages: transactions.map(tx => bs58.encode(tx.serializeMessage())),
    });
    const signatures = response.signatures.map(s => bs58.decode(s));
    const publicKey = new PublicKey(response.publicKey);
    transactions = transactions.map((tx, idx) => {
      tx.addSignature(publicKey, signatures[idx]);
      return tx;
    });
    return transactions;

  }
}
