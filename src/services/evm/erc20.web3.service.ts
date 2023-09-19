import { PrismaClient } from "@prisma/client";
import Web3 from "web3";
import { EVM_BASE_COIN, STATUS_ACTIVE } from "../../utils/coreConstant";
import { generateErrorResponse, generateSuccessResponse } from "../../utils/commonObject";
import { ERC20_ABI } from "../../contract/erc20.token.abi";
import { REGEX, addNumbers, convertCoinAmountFromInt, convertCoinAmountToInt, customFromWei, minusNumbers, multiplyNumbers, sleep } from "../../utils/helper";
import { TransactionConfig, TransactionReceipt, Transaction } from 'web3-core';


const prisma = new PrismaClient();

// initialize web3
const initializeWeb3 = async (rpcUrl:string) => { 
   const connectWeb3 = new Web3(new Web3.providers.HttpProvider(rpcUrl));
  
  return connectWeb3;
};

// create eth address
const createEthAddress = async (rpcUrl: string) => {
  try {
    const connectWeb3: any = await initializeWeb3(rpcUrl);
    let wallet = await connectWeb3.eth.accounts.create();
    if (wallet) {
      const data = {
        address:wallet.address,
        pk:wallet.privateKey,
      }
      return generateSuccessResponse("Wallet created successfully", data);
    } else {
      return generateErrorResponse("Wallet not generated");
    }
  } catch(err) {
    console.log(err);
    return generateErrorResponse("Something went wrong");
  }
};

// get eth balance
const getEthBalance = async (rpcUrl: string, address:string) => {
  try {
    const connectWeb3: any = await initializeWeb3(rpcUrl);
  
    let balance = '0';
    const netBalance = await connectWeb3.eth.getBalance(address);
    if (netBalance) {
      balance = Web3.utils.fromWei(netBalance.toString(), 'ether');
      return generateSuccessResponse("Balance get successfully", balance);
    } else {
      return generateErrorResponse("Balance get failed", balance);
    }
  } catch (err) {
    console.log(err);
    return generateErrorResponse("Something went wrong");
  }
}

// get estimate fees for eth
const estimateEthFee = async (
  rpcUrl: string, 
  coinType:string, 
  coinDecimal:any, 
  gasLimit:any, 
  fromAddress:string, 
  toAddress:string,
  amount:number
  ) => {
  try {
    const connectWeb3 = await initializeWeb3(rpcUrl);
    const gasPrice = await connectWeb3.eth.getGasPrice();

    let message = '';

    const tx: TransactionConfig = {
      from: connectWeb3.utils.toChecksumAddress(fromAddress),
      to: connectWeb3.utils.toChecksumAddress(toAddress),
      value: convertCoinAmountToInt(amount,coinDecimal),
      gasPrice: gasPrice.toString(),
      gas: gasLimit.toString()
    };

    const maxFee = Number(convertCoinAmountToInt(
      multiplyNumbers(gasLimit,Number(gasPrice)),coinDecimal,)
    );

    const balanceRequired = addNumbers(Number(maxFee),amount);
    const balance = await getEthBalance(rpcUrl,fromAddress);

    if (Number(balanceRequired) > Number(balance)) {
      const balanceShortage = minusNumbers(
        Number(balanceRequired),
        Number(balance),
      );
      message = `${'Insufficient '} ${coinType} ${
        'balance including fee'}!!\n
       ${'balance required'}: ${balanceRequired.toFixed(
        10,
      )} ${coinType},\n
       ${'balance exists'}: ${balance} ${coinType},\n
       ${'balance shortage'}: ${balanceShortage.toFixed(
        12,
      )} ${coinType}.\n
       ${'Try less amount.'}`;
      console.log(message);
      // console.log('\n');
      return generateErrorResponse(message);
    }

    const gas = await connectWeb3.eth.estimateGas(tx);

    if (gas > gasLimit) {
      message = `Network is too busy now, Fee is too high. ${
        'Sending'
      } ${coinType} ${'coin .'}
      ${'it will ran out of gas. gas needed'}=${gas}, ${
        'gas limit we are sending'}=${gasLimit}`;
      // console.log(message);
      // console.log('\n');
      return generateErrorResponse(message);
    }

    const estimatedFee = Number(
      convertCoinAmountFromInt(
        multiplyNumbers(gas, Number(gasPrice)),
        coinDecimal,
      ),
    );

    return generateSuccessResponse('success', {
      fee:estimateEthFee
    })

  } catch( err ) {
    console.log(err);
    return generateErrorResponse("Something went wrong");
  }
} 

// send eth coin
const sendEthCoin = async (
  rpcUrl:string,
  coinType:string, 
  coinDecimal:any, 
  gasLimit:number,
  from_address:string,
  to_address:string,
  amount:number,
  pk:string
) => {
  try {
    const connectWeb3 = await initializeWeb3(rpcUrl);
    const gasPrice = await connectWeb3.eth.getGasPrice();
    const fromAddress = connectWeb3.utils.toChecksumAddress(from_address)

    const tx: TransactionConfig = {
      from: fromAddress,
      to: connectWeb3.utils.toChecksumAddress(to_address),
      value: convertCoinAmountToInt(amount, coinDecimal),
      gasPrice: gasPrice.toString(),
      gas: gasLimit.toString(),
    };

    const response = await estimateEthFee(rpcUrl,
      coinType, 
      coinDecimal, 
      gasLimit,
      from_address,
      to_address,
      amount);
    if (response.success == false) {
      return generateErrorResponse(response.message);
    }  

    let nonce = await connectWeb3.eth.getTransactionCount(fromAddress,'latest');
    tx.nonce = nonce;
    const txObj = await executeEthTransaction(
      tx,
      connectWeb3,
      pk,
      coinType,
    );


  } catch(err) {
    console.log(err); 
    return generateErrorResponse("Something went wrong")
  }
}

// execute eth transaction
const executeEthTransaction = async(
  tx:TransactionConfig,
  connectWeb3:any,
  pk:string,
  coin_type:string,
  blockConfirmation = 0,
  waitForConfirm = false,
) => {
  const signedTx = await connectWeb3.eth.accounts.signTransaction(tx, pk);
  let txObj: TransactionReceipt = {
    status: false,
    transactionHash: '',
    transactionIndex: 0,
    blockHash: '',
    blockNumber: 0,
    from: '',
    to: '',
    cumulativeGasUsed: 0,
    gasUsed: 0,
    logs: [],
    logsBloom: '',
  };
  try {
    txObj = await connectWeb3.eth.sendSignedTransaction(signedTx.rawTransaction);
  } catch(e:any) {
    if (!e.message.includes('Transaction was not mined within')) {
      console.error(
        `coin send error on network: ${coin_type}, tx hash: ${signedTx.transactionHash}`,
      );
      console.error(e.stack);
      throw e;
    } else {
      txObj.transactionHash = signedTx.transactionHash;
      return txObj;
    }
  }
  if (waitForConfirm) {
    await waitForTxConfirmed(txObj, connectWeb3, blockConfirmation);
  }
  return txObj;
}


// wait for tx confirmed
const waitForTxConfirmed = async(
  txObj: TransactionReceipt,
  connectWeb3:any,
  blockConfirmation:number
) => {
  try {
    let confirmations = 0;
    while (confirmations < blockConfirmation) {
      await sleep(15000); // sleep 15 sec

      const currentBlock = await connectWeb3.eth.getBlockNumber();
      confirmations = currentBlock - txObj.blockNumber;
    }
    const tx = await connectWeb3.eth.getTransaction(txObj.transactionHash);
    if (!tx) return generateErrorResponse(`Transaction Failed: ${txObj.transactionHash}`);
    return;
  } catch(e:any) {
    console.log(e.stack)
  }
}

const getTransaction = async(rpcUrl:string,txHash:string): Promise<any> => {
  try {
    const connectWeb3 = await initializeWeb3(rpcUrl);
    const txObj = await connectWeb3.eth.getTransaction(txHash);
    return txObj;
  } catch(e) {
    console.log(e);
    return null;
  }
}

const getConfirmedTransaction = async(rpcUrl:string,txHash: string): Promise<any> => {
  try {
    const connectWeb3 = await initializeWeb3(rpcUrl);
    const txObj = await connectWeb3.eth.getTransactionReceipt(txHash);
    return txObj;
  } catch (e) {
    return null;
  }
}

const getTransactionReceipt = async(rpcUrl:string,txHash: string): Promise<any> => {
  try {
    const connectWeb3 = await initializeWeb3(rpcUrl);
    const txObj = await connectWeb3.eth.getTransactionReceipt(txHash);
    return txObj;
  } catch (e) {
    return null;
  }
}

const getBlockNumber = async(rpcUrl:string): Promise<string | number>  => {
  const connectWeb3 = await initializeWeb3(rpcUrl);
  return await connectWeb3.eth.getBlockNumber();
}

const validateAddress = async (rpcUrl:string, address: string): Promise<boolean> => {
  const connectWeb3 = await initializeWeb3(rpcUrl);
  return connectWeb3.utils.isAddress(address);
}

const validateTxHash = async (txHash: string): Promise<boolean> =>{
  return new RegExp(REGEX.ETH_TXHASH).test(txHash);
}


// export const createEvmAddress = async (rpcUrl: string|null) => {
//   rpcUrl = rpcUrl || "/";
//   const connectWeb3: any = new Web3(new Web3.providers.HttpProvider(rpcUrl));
//   let wallet = await connectWeb3.eth.accounts.create();
//   if (wallet) {
//     return generateSuccessResponse("Wallet created successfully", wallet);
//   } else {
//     return generateErrorResponse("Wallet not generated");
//   }
// };

export {
  createEthAddress,
  getEthBalance,
  estimateEthFee,
  sendEthCoin,
  getTransaction,
  getConfirmedTransaction,
  getTransactionReceipt,
  getBlockNumber,
  validateAddress,
  validateTxHash
};
