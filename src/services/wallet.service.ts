import { PrismaClient } from "@prisma/client";
import { EVM_BASE_COIN, STATUS_ACTIVE } from "../utils/coreConstant";
import { generateErrorResponse, generateSuccessResponse } from "../utils/commonObject";
import createEthAddress from "./web3.service";

const prisma = new PrismaClient();

const createAddress = async (coinType: any, network: number) => {
  const user = ""
    const getNetwork = await prisma.networks.findFirst({
        where: {
            id: network,
            status: STATUS_ACTIVE
        }
    });
    
  if (getNetwork) {
    let wallet = generateErrorResponse("Invalid base type");
    if (getNetwork.base_type == EVM_BASE_COIN) {
        wallet = await createEthAddress(coinType, network);
          // if (wallet) {
          //     return generateSuccessResponse("Wallet created successfully",wallet);
          //   } else {
          //     return generateErrorResponse("Wallet not generated");
          //   }
    } else {
      wallet = generateErrorResponse("Invalid base type");
    }
    if (wallet.success) {
      // const userWallet = await prisma.wallets.findFirst({
      //   where: {
      //     user_id: user.id,
      //     coin_type: coinType
      //   }
      // });

    }
  } else {
    return generateErrorResponse("Network not found");
  } 
};

export default (
    createAddress
)
