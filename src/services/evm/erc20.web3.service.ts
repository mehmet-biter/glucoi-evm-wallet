import { PrismaClient } from "@prisma/client";
import Web3 from "web3";
import { EVM_BASE_COIN, STATUS_ACTIVE } from "../../utils/coreConstant";
import { generateErrorResponse, generateSuccessResponse } from "../../utils/commonObject";
import { ERC20_ABI } from "../../contract/erc20.token.abi";
import { REGEX, addNumbers, convertCoinAmountFromInt, convertCoinAmountToInt, customFromWei, customToWei, minusNumbers, multiplyNumbers, sleep } from "../../utils/helper";
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
  let balance:any = 0;
  try {
    const connectWeb3: any = await initializeWeb3(rpcUrl);

    if(!(Web3.utils.isAddress(address)))
      return generateErrorResponse("Invalid address provided");

    const netBalance = await connectWeb3.eth.getBalance(address);
    if (netBalance) {
      balance = Web3.utils.fromWei(netBalance.toString(), 'ether');
      return generateSuccessResponse("Balance get successfully", balance);
    } else {
      return generateErrorResponse("Balance get failed", balance);
    }
  } catch (err) {
    console.log(err);
    return generateErrorResponse("Something went wrong", balance);
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
      from: Web3.utils.toChecksumAddress(fromAddress),
      to: Web3.utils.toChecksumAddress(toAddress),
      value: customToWei(amount,coinDecimal),
      gasPrice: gasPrice.toString(),
      gas: gasLimit.toString()
    };

    // const maxFee = Number(convertCoinAmountToInt(
    //   multiplyNumbers(gasLimit,Number(gasPrice)),coinDecimal,)
    // );
    let maxFee = customFromWei(multiplyNumbers(gasLimit, Number(gasPrice)),coinDecimal);

    
    maxFee = parseFloat(maxFee.toString()).toFixed(coinDecimal);
    console.log('maxFee', maxFee);
    const balanceRequired = parseFloat((addNumbers(Number(maxFee),amount)).toString()).toFixed(coinDecimal);
    const balanceData:any = await getEthBalance(rpcUrl,fromAddress);
    const balance = balanceData['data'];
    console.log('balance', balance)
    console.log('balanceRequired', balanceRequired)

    if (Number(balanceRequired) > Number(balance)) {
      const balanceShortage = minusNumbers(
        Number(balanceRequired),
        Number(balance),
      );
      message = `${'Insufficient '} ${coinType} ${
        'balance including fee'}!!\n
       ${'balance required'}: ${balanceRequired} ${coinType},\n
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
    const estimatedFee = customFromWei(multiplyNumbers(gas, Number(gasPrice)),coinDecimal);
    const nowFees = parseFloat(estimatedFee.toString()).toFixed(coinDecimal);
    

    return generateSuccessResponse('success', {
      fee:estimatedFee
    })

  } catch( err:any ) {
    console.log(err);
    return generateErrorResponse(err?.message);
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
    const fromAddress = Web3.utils.toChecksumAddress(from_address)

    const tx: TransactionConfig = {
      from: fromAddress,
      to: Web3.utils.toChecksumAddress(to_address),
      value: customToWei(amount, coinDecimal),
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

    let nonce = (await connectWeb3.eth.getTransactionCount(fromAddress,'latest')) + 10;
    tx.nonce = nonce;
    const txObj = await executeEthTransaction(
      tx,
      connectWeb3,
      pk,
      coinType,
    );
    return txObj; 

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
    console.log('txObj', txObj)
  } catch(e:any) {
    console.log('executeEthTransaction ex', e);
    if (!e.message.includes('Transaction was not mined within')) {
      console.error(
        `coin send error on network: ${coin_type}, tx hash: ${signedTx.transactionHash}`,
      );
      console.error(e.stack);
      return generateErrorResponse(e.message,"");
    } else {
      txObj.transactionHash = signedTx.transactionHash;
      return generateErrorResponse(e.message,txObj);
    }
  }
  if (waitForConfirm) {
    await waitForTxConfirmed(txObj, connectWeb3, blockConfirmation);
  }
  const data = {
    block_hash:txObj.blockHash,
    block_number:txObj.blockNumber,
    contract_address:txObj.contractAddress,
    from_address:txObj.from,
    used_gas:txObj.gasUsed,
    to:txObj.to,
    transaction_id:txObj.transactionHash,
    status:txObj.status,
  }
  return generateSuccessResponse('Coin send successfully',data);
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
  return Web3.utils.isAddress(address);
}

const validateTxHash = async (txHash: string): Promise<boolean> =>{
  return new RegExp(REGEX.ETH_TXHASH).test(txHash);
}

const getAddressByPrivateKey = async(rpcUrl:string, pk:string) => {
  try {
    const web3 = await initializeWeb3(rpcUrl);
    const response = await web3.eth.accounts.privateKeyToAccount(pk);
    if (response) {
      return generateSuccessResponse('Get address success', {address:response.address})
    } else {
      return generateErrorResponse('Get address failed');
    }
  } catch(err:any) {
    console.log(err);
    return generateErrorResponse(err.stack)
  }
}

// get latest block number
const getLatestBlockNumber = async(web3:any) => {
  return await web3.eth.getBlockNumber();
}
// get block 
const getBlockData = async(web3:any,blockNumber:number) => {
  return await web3.eth.getBlock(blockNumber, true);
}

// get block transaction count
const getBlockTransactionCount = async(web3:any,blockNumber:number) => {
  return await web3.eth.getBlockTransactionCount(blockNumber, true);
}

// get latest transaction
const getLatestTransaction = async(
  rpcUrl:string,
  fromBlockNumber?: number,
  ) => {
  try {
    console.log('getLatestTransaction', 'called')
    const web3:any = await initializeWeb3(rpcUrl);
    let blockNumber = await getLatestBlockNumber(web3);
    
    if(fromBlockNumber && fromBlockNumber > 0) {
      blockNumber = fromBlockNumber
    }

    let resultData:any = [];
    console.log('blockNumber', blockNumber)
    const txCount = await getBlockTransactionCount(web3,blockNumber);
    const blockData = await getBlockData(web3,blockNumber);
    console.log('txCount', txCount)
    if(blockData && blockData.transactions) {
      blockData.transactions.forEach((res:any) => {
        // console.log('res => ',res);

        let innerData = {
            tx_hash: res.hash,
            block_hash: res.blockHash,
            from_address: res.from,
            to_address: res.to,
            amount: Web3.utils.fromWei(res.value, 'ether'),
            block_number: blockData.number,
            gas: res.gas,
            gas_price: res.gasPrice,
            input:res.input,
            nonce:res.nonce,
            transactionIndex:res.transactionIndex,
            value: res.value,
            type:res.type,
            chain_id: res.chainId
        };
        resultData.push(innerData)
      
      });
    }
    
      // console.log('resultData', resultData)

    return generateSuccessResponse("success", resultData);  
  } catch(err:any) {
    console.log('getLatestTransaction',err);
    return generateErrorResponse(err.stack)
  }
}

// get estimate fees for eth
const estimateGasFee = async (
  rpcUrl: string, 
  coinDecimal:any, 
  gasLimit:any, 
  toAddress:string,
  amount:number
  ) => {
  try {
    const connectWeb3 = await initializeWeb3(rpcUrl);
    const gasPrice = await connectWeb3.eth.getGasPrice();

    const tx: TransactionConfig = {
      to: Web3.utils.toChecksumAddress(toAddress),
      value: customToWei(amount,coinDecimal),
      gasPrice: gasPrice.toString(),
      gas: gasLimit.toString()
    };
    
    const gas = await connectWeb3.eth.estimateGas(tx);
    const estimatedFee = customFromWei(multiplyNumbers(gas, Number(gasPrice)),coinDecimal);    
 
    return generateSuccessResponse('success', {
      fee:estimatedFee //customToWei(Number(estimatedFee),coinDecimal)
    })

  } catch( err:any ) {
    console.log(err);
    return generateErrorResponse(err?.message);
  }
} 

// wait for tx confirmed
const waitForTxConfirmedForGas = async(
  rpcUrl: string,
  txObj: any,
  blockConfirmation:number
) => {
  try {
    const connectWeb3 = await initializeWeb3(rpcUrl);
    let confirmations = 0;
    while (confirmations < blockConfirmation) {
      await sleep(15000); // sleep 15 sec

      const currentBlock = await connectWeb3.eth.getBlockNumber();
      confirmations = currentBlock - txObj.block_number;
    }
    const tx = await connectWeb3.eth.getTransaction(txObj.transaction_id);
    if (!tx) return generateErrorResponse(`Transaction Failed: ${txObj.transaction_id}`);
    return generateSuccessResponse("Transaction Success");
  } catch(e:any) {
    console.log(e.stack)
    return generateSuccessResponse("Transaction Failed");
  }
}

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
  validateTxHash,
  executeEthTransaction,
  getAddressByPrivateKey,
  getLatestBlockNumber,
  getLatestTransaction,
  estimateGasFee,
  waitForTxConfirmedForGas
};
