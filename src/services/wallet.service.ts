import { PrismaClient } from "@prisma/client";
import { EVM_BASE_COIN, STATUS_ACTIVE } from "../utils/coreConstant";
import { generateErrorResponse, generateSuccessResponse } from "../utils/commonObject";
import createEthAddress from "./web3.service";

const prisma = new PrismaClient();

const createAddress = async (user:any,coinType: any, network: number) => {
  const User = user.user_details;
  const getNetwork = await prisma.networks.findUnique({
    where : {
      id : network
    }
  });

  const userWallet = await prisma.wallets.findFirst({
    where: {
      user_id: Number(User.id),
      coin_type: coinType
    }
  });
  if(!userWallet) return generateErrorResponse("Wallet not found");

  const walletAddress = await prisma.wallet_address_histories.findFirst({
    where: {
      user_id : Number(User.id),
      coin_type : coinType,
      network_id : Number(getNetwork?.id),
      wallet_id : Number(userWallet?.id),
    }
  });
  if(walletAddress) return generateSuccessResponse("Wallet address found successfully", walletAddress.address);

  if (getNetwork) {
    let wallet = generateErrorResponse("Invalid base type");
    if (getNetwork.base_type == EVM_BASE_COIN) {
        wallet = await createEthAddress(coinType, network);
          if(await createWalletAddressHistorie(Number(User.id), coinType, Number(getNetwork.id), wallet, userWallet)) {
            return generateSuccessResponse("Wallet created successfully",wallet.data.address);
          } else {
            return generateErrorResponse("Wallet not generated");
          }
    } else {
      wallet = generateErrorResponse("Invalid base type");
    }
  }
  return generateErrorResponse("Network not found"); 
};

const createWalletAddressHistorie = async (userId:number, coinType:string, networkId:number, wallet:any, userWallet:any) => {
  if(wallet?.success){
    const walletAddress = await prisma.wallet_address_histories.create({
      data : {
        user_id : userId,
        coin_type : coinType,
        network_id : networkId,
        wallet_id : Number(userWallet?.id),
        wallet_key : wallet.data.privateKey,
        address : wallet.data.address,
      }
    });
    if(walletAddress) return true;
    return false;
  } 
  return false;
}

export default (
    createAddress
)
