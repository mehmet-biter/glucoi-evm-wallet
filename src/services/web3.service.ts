import { PrismaClient } from "@prisma/client";
import Web3 from "web3";
import { EVM_BASE_COIN, STATUS_ACTIVE } from "../utils/coreConstant";

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
    console.log("rpcUrl", rpcUrl);
  const connectWeb3 = new Web3(new Web3.providers.HttpProvider(rpcUrl));
  
  return connectWeb3;
};

const createAddress = async (coinType: any, network: number) => {
    const getNetwork = await prisma.networks.findFirst({
        where: {
            id: network,
            status: STATUS_ACTIVE
        }
    });
    if (getNetwork) {
        if (getNetwork.base_type == EVM_BASE_COIN) {
              const connectWeb3: any = await initializeWeb3(coinType, network);
              let wallet = await connectWeb3.eth.accounts.create();
              if (wallet) {
                return {
                  success: true,
                  message: "Wallet created successfully",
                  data: wallet,
                };
              } else {
                return {
                  status: false,
                  message: "Wallet not generated",
                  data: {},
                };
              }
        }
        
    } else {
        return {
          status: false,
          message: "Network not found",
          data: {},
        };
    }
    
};

export default (
    createAddress
)
