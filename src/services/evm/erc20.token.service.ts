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

// initialize contract
const initializeErc20Contact = async (web3:any, contractAddress:string) => {
  const tokenContract = new (await web3).eth.Contract(JSON.parse(ERC20_ABI), contractAddress);
  return tokenContract;
}

// get contract decimal
const contractDecimal = async (tokenContract:any) => {
  return await tokenContract.methods.decimals().call();
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

// send erc20 token
const sendErc20Token = async(
  rpcUrl:string,
  contractAddress:string,
  from_address:string,
  to_address:string,
  pk:string,
  amount:number
  ) => {
  try {
    const web3 = await initializeWeb3(rpcUrl);

    const validateToAddress = await web3.utils.isAddress(to_address);
    if (validateToAddress) {

    } else {
      return generateErrorResponse("Invalid address");
    }
  } catch(err:any) {
    console.log(err);
    return generateErrorResponse(err.stack)
  }
}

export {
  getEthTokenBalance,
  sendErc20Token
};
