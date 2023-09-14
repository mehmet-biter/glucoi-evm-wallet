import { PrismaClient } from "@prisma/client";
import Web3 from "web3";
import { EVM_BASE_COIN, STATUS_ACTIVE } from "../../utils/coreConstant";
import { generateErrorResponse, generateSuccessResponse } from "../../utils/commonObject";
import { ERC20_ABI } from "../../contract/erc20.token.abi";
import { customFromWei } from "../../utils/helper";

const prisma = new PrismaClient();

const initializeWeb3 = async (network:number) => {
  let rpcUrl = "";
  const coin: any = await prisma.$queryRaw`
    select * from coin_networks 
    join networks on networks.id = coin_networks.network_id
    join supported_network on networks.slug = supported_network.slug
    where networks.id = ${network} limit 1
    `;
  
    if (coin && coin.length > 0) {
        rpcUrl = coin[0].rpc_url;
    }
   
   const connectWeb3 = new Web3(new Web3.providers.HttpProvider(rpcUrl));
  
  return connectWeb3;
};

const initializeErc20Contact = async (web3:any, contractAddress:string) => {
  const tokenContract = new (await web3).eth.Contract(JSON.parse(ERC20_ABI), contractAddress);
  return tokenContract;
}

// get contract decimal
const contractDecimal = async (tokenContract:any) => {
  return await tokenContract.methods.decimals().call();
}

const createEthAddress = async (coinType: string, network: number) => {
  try {
    const connectWeb3: any = await initializeWeb3(network);
    let wallet = await connectWeb3.eth.accounts.create();
    if (wallet) {
      return generateSuccessResponse("Wallet created successfully", wallet);
    } else {
      return generateErrorResponse("Wallet not generated");
    }
  } catch(err) {
    console.log(err);
    return generateErrorResponse("Something went wrong");
  }
};

const getEthBalance = async (coinType: string, network: number, address:string) => {
  try {
    const connectWeb3: any = await initializeWeb3(network);
  
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

const getEthTokenBalance = async (coinType: string, network: number, address:string, contractAddress:string) => {
  try {
    const connectWeb3: any = await initializeWeb3( network);
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

export default [
  createEthAddress,
  getEthBalance,
  getEthTokenBalance
];
