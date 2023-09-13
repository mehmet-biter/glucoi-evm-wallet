import { PrismaClient } from "@prisma/client";
import Web3 from "web3";
import { EVM_BASE_COIN, STATUS_ACTIVE } from "../utils/coreConstant";
import { generateErrorResponse, generateSuccessResponse } from "../utils/commonObject";

const prisma = new PrismaClient();
const initializeWeb3 = async (coinType: any, network:number) => {
  let rpcUrl = "";
  const coin: any = await prisma.$queryRaw`
    select * from coins
    join coin_networks on coins.id = coin_networks.currency_id
    join networks on networks.id = coin_networks.network_id
    where coins.coin_type = ${coinType} and networks.id = ${network} limit 1
    `;
  
    if (coin && coin.length > 0) {
        rpcUrl = coin[0].rpc_url;
    }
   
   const connectWeb3 = new Web3(new Web3.providers.HttpProvider(rpcUrl));
  
  return connectWeb3;
};

export const createEthAddress = async (coinType: any, network: number) => {
    
    const connectWeb3: any = await initializeWeb3(coinType, network);
    let wallet = await connectWeb3.eth.accounts.create();
  if (wallet) {
    return generateSuccessResponse("Wallet created successfully", wallet);
  } else {
    return generateErrorResponse("Wallet not generated"); 
  }
};

export const createEvmAddress = async (rpcUrl: string|null) => {
  rpcUrl = rpcUrl || "/";
  const connectWeb3: any = new Web3(new Web3.providers.HttpProvider(rpcUrl));
  let wallet = await connectWeb3.eth.accounts.create();
  if (wallet) {
    return generateSuccessResponse("Wallet created successfully", wallet);
  } else {
    return generateErrorResponse("Wallet not generated");
  }
};

export default {createEthAddress,createEvmAddress};
