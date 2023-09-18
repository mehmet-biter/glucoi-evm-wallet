import { PrismaClient } from "@prisma/client";
import { EVM_BASE_COIN, STATUS_ACTIVE } from "../utils/coreConstant";
import { generateErrorResponse, generateSuccessResponse } from "../utils/commonObject";
import { createEthAddress } from "./evm/erc20.web3.service";

const prisma = new PrismaClient();

 const createAddress = async (user:any,coinType: string, network: number) => {
  const User = user.user_details;
  const getNetwork = await getNetworkData(network);

  const userWallet = await getWalletData(Number(User.id), coinType);
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
        // wallet = await createEthAddress(coinType, network);
        //   if(await createWalletAddressHistorie(Number(User.id), coinType, Number(getNetwork.id), wallet, userWallet)) {
        //     return generateSuccessResponse("Wallet created successfully",wallet.data.address);
        //   } else {
        //     return generateErrorResponse("Wallet not generated");
        //   }
    } else {
      wallet = generateErrorResponse("Invalid base type");
    }
  }
  return generateErrorResponse("Network not found"); 
};

 const createSystemAddress = async (user:any, network: number) => {
  const User = user.user_details;
  const getNetwork = await getNetworkData(Number(network));

  const userWallet = await getSystemWalletData(Number(network));
  if(userWallet) return generateSuccessResponse("Wallet address found successfully", userWallet.address);

  if (getNetwork) {
    let wallet = generateErrorResponse("Invalid base type");
    // if (getNetwork.base_type == EVM_BASE_COIN) {
    //     wallet = await createEvmAddress(getNetwork.rpc_url);
    //       if(wallet) {
    //         return generateSuccessResponse("Wallet created successfully",wallet.data);
    //       } else {
    //         return generateErrorResponse("Wallet not generated");
    //       }
    // } else {
    //   wallet = generateErrorResponse("Invalid base type");
    // }
  }
  return generateErrorResponse("Network not found"); 
};

const getNetworkData = async (network: number) => {
  const networkData = await prisma.networks.findUnique({
    where : {
      id : network
    }
  });
  return networkData;
}

const getWalletData = async (userId: number, coinType:string) => {
  return await prisma.wallets.findFirst({
    where: {
      user_id: userId,
      coin_type: coinType
    }
  });
}

const getSystemWalletData = async (network: number) => {
  return await prisma.admin_wallet_keys.findFirst({
    where: {
      network_id: network,
    }
  });
}

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

export {
    createAddress,
    createSystemAddress,
}
