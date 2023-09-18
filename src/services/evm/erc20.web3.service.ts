import { PrismaClient } from "@prisma/client";
import Web3 from "web3";
import { EVM_BASE_COIN, STATUS_ACTIVE } from "../../utils/coreConstant";
import { generateErrorResponse, generateSuccessResponse } from "../../utils/commonObject";
import { ERC20_ABI } from "../../contract/erc20.token.abi";
import { addNumbers, convertCoinAmountFromInt, convertCoinAmountToInt, customFromWei, minusNumbers, multiplyNumbers } from "../../utils/helper";
import { TransactionConfig } from 'web3-core';


const prisma = new PrismaClient();

// initialize web3
const initializeWeb3 = async (rpcUrl:string) => { 
   const connectWeb3 = new Web3(new Web3.providers.HttpProvider(rpcUrl));
  
  return connectWeb3;
};

// initialize contract
const initializeErc20Contact = async (web3:any, contractAddress:string) => {
  const tokenContract = new (await web3).eth.Contract(JSON.parse(ERC20_ABI), contractAddress);
  return tokenContract;
}

// get contract decimal
const contractDecimal = async (tokenContract:any) => {
  return await tokenContract.methods.decimals().call();
}

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

// get eth token balance
const getEthTokenBalance = async (rpcUrl: string, address:string, contractAddress:string) => {
  try {
    const connectWeb3: any = await initializeWeb3(rpcUrl);
    const tokenContract = await initializeErc20Contact(connectWeb3, contractAddress)
    let balance:any = 0;
    const tokenBalance = await tokenContract.methods.balanceOf(address).call();
    const tokenDecimal = await contractDecimal(tokenContract);
    if (tokenBalance) {
      balance = customFromWei(tokenBalance, tokenDecimal);
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
  amount:any
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
  getEthTokenBalance,
};
