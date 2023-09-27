import { PrismaClient } from "@prisma/client";
import { EVM_BASE_COIN, STATUS_ACTIVE, TRON_BASE_COIN, WITHDRAWAL_FIXED_FEES, WITHDRAWAL_PERCENTAGE_FEES,
         ADDRESS_TYPE_INTERNAL, ADDRESS_TYPE_EXTERNAL, STATUS_PENDING, NATIVE_COIN } from "../utils/coreConstant";
import { generateErrorResponse, generateSuccessResponse } from "../utils/commonObject";
import { createEthAddress, sendEthCoin } from "./evm/erc20.web3.service";
import { custome_encrypt, custome_decrypt, fees_calculator, generateRandomString } from "../utils/helper";
import { sendErc20Token } from "./evm/erc20.token.service";
import { createTrxAddress } from "./evm/trx.tron-web.service";
import { sendTrxToken } from "./evm/trx.token.service";
import console from "console";

const prisma = new PrismaClient();

 const createAddress = async (user:any,coinType: string, network: number) => {
  const User = user.user_details;
  const getNetwork = await getNetworkData(network);
  console.log(getNetwork);
  const userWallet = await getWalletData(Number(User.id), coinType);
  if(!userWallet) return generateErrorResponse("Wallet not found");

    const walletAddresses = await prisma.wallet_address_histories.findMany({
      where: {
        user_id : Number(User.id),
        // coin_type : coinType,
        network_id : Number(getNetwork?.id),
        // wallet_id : Number(userWallet?.id),
      }
    });
  
    let walletAddress:any = null;
    if(walletAddresses?.length > 0 )  {
      for(let i =0; i< walletAddresses.length;i++) {
        const address = walletAddresses[i];
        if (address?.coin_type == coinType && Number(address?.wallet_id) == Number(userWallet?.id)) {
          walletAddress = address;
          break;
        }
      }
  
      if (!walletAddress) {
        walletAddress = await prisma.wallet_address_histories.create({
          data: {
            user_id : Number(User.id),
            coin_type : coinType,
            network_id : Number(getNetwork?.id),
            wallet_id : Number(userWallet?.id),
            address: walletAddresses[0].address,
            wallet_key: walletAddresses[0].wallet_key,
          }
        });
      }
    }
    
    if(walletAddress && walletAddress.address) {
      return generateSuccessResponse("Wallet address found successfully", walletAddress.address);
    }

  if (getNetwork) {
    let wallet = null;

    if (getNetwork.base_type == EVM_BASE_COIN) {
        wallet = await createEthAddress(getNetwork.rpc_url ?? '/');
    } else if(getNetwork.base_type == TRON_BASE_COIN) {
        wallet = await createTrxAddress(getNetwork.rpc_url ?? '/'); 
    } 

    if(wallet && wallet.success){
        let walletAddressHistory = await createWalletAddressHistorie(Number(User.id), coinType, Number(getNetwork.id), wallet, userWallet);
        if(walletAddressHistory) return generateSuccessResponse("Wallet created successfully",wallet.data.address);
        return generateErrorResponse("Wallet not generated");
    }
    return generateErrorResponse("Invalid base type");
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
    if (getNetwork.base_type == EVM_BASE_COIN) {
        wallet = await createEthAddress(getNetwork.rpc_url ?? '/');
          if(wallet && wallet?.success) {
            return generateSuccessResponse("Wallet created successfully",wallet.data);
          } else {
            return generateErrorResponse("Wallet not generated");
          }
    } else {
      wallet = generateErrorResponse("Invalid base type");
    }
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
  if(wallet?.success){ console.log(wallet);
    const walletAddress = await prisma.wallet_address_histories.create({
      data : {
        user_id : userId,
        coin_type : coinType,
        network_id : networkId,
        wallet_id : Number(userWallet?.id),
        wallet_key : await custome_encrypt(wallet.data.pk),
        address : wallet.data.address,
      }
    });
    if(walletAddress) return true;
    return false;
  } 
  return false;
}

const walletWithdrawalService = async (request: any) => {
  // check base type
  if(!checkBaseType(request.base_type)) 
    return generateErrorResponse("Base type in invalid");

  const user = request.user.user_details;

  // check user wallet
  const wallet = await prisma.wallets.findFirst({
    where: {
      id: request.wallet_id,
      user_id: Number(user.id),
    }
  });
  if(!wallet) return generateErrorResponse("Wallet not find");
  
  // check Coin
  const coin = await prisma.coins.findFirst({
    where: {
      id: wallet.coin_id,
    }
  });
  if(!coin) return generateErrorResponse("Coin not find");

  // check validation
  let validateResponse = await checkWithdrawalValidation(request, user, wallet, coin);
  if(!(validateResponse?.success)) return generateErrorResponse(validateResponse?.message ?? "Request validate failed");

  let data = {
    'wallet_id' : wallet.id,
    'amount' : request.amount,
    'address' : request.address,
    'note' : request.note ?? '',
    'user' : user,
    'network_id' : request.network_id,
    'base_type' : request.base_type,
  };

  // this code will be executed in queue, start here
  await executeWithdrawal(data);
  // this code will be executed in queue, end here

  // check admin approval
  if(coin.admin_approval == STATUS_ACTIVE)
      return generateSuccessResponse("Withdrawal process started successfully. Please wait for admin approval");
  return generateSuccessResponse("Withdrawal request placed successfully.");
}

const executeWithdrawal = async (data:any) => {
    // check user wallet
    const job_wallet = await prisma.wallets.findFirst({
      where: {
        id: data.wallet_id,
        user_id: Number(data.user.id),
      }
    });
    if(job_wallet) {
      // check Coin
      const job_coin = await prisma.coins.findFirst({
        where: {
          id: job_wallet.coin_id,
        }
      });
  
      let validateResponse = await checkWithdrawalValidation(data, data.user, job_wallet, job_coin);
      if(!(validateResponse?.success)) {
        console.log(generateErrorResponse(validateResponse?.message ?? "Request validate failed"));
        return;
      }
      let makeData:any = {};
      let trx = generateRandomString(32);
      let fees = 0;
      let receiverWallet = null;
      let receiverUser = null;
      let address_type = null;
      let receiver_Address = validateResponse?.data?.receiverAddress
      if(!receiver_Address){
  
        receiverWallet= { address: data.address };
        receiverUser = null;
        address_type = ADDRESS_TYPE_EXTERNAL;
        fees = validateResponse?.data?.fees;
  
      }else{
  
        fees = 0;
        receiverWallet = validateResponse?.data?.receiverWallet; console.log('receiverWallet', receiverWallet);
        receiverUser = validateResponse?.data?.wallet.user;
        address_type = ADDRESS_TYPE_INTERNAL;
        if ( data.user.id == receiverUser.id ) {
            console.log('You can not send to your own wallet!');
            return;
        }
        if ( data.wallet.coin_type != validateResponse?.data?.wallet.coin_type ) {
            console.log('You can not make withdrawal, because wallet coin type is mismatched. Your wallet coin type and withdrawal address coin type should be same.');
            return;
        }
  
      }
      const date = new Date();
      makeData.created_at = date.toISOString();
      makeData.updated_at = date.toISOString();
      makeData.amount         = data.amount;
      makeData.fees           = fees;
      makeData.receiverWallet = receiverWallet;
      makeData.receiverUser   = receiverUser;
      makeData.address_type   = address_type;
      makeData.user           = data.user;
      makeData.wallet         = job_wallet;
      makeData.trx            = trx;
      makeData.base_type      = data.base_type;
      makeData.network_id     = data.network_id;

      const senderWalletUpdate = await prisma.wallets.update({
        where: { id: job_wallet.id },
        data: {
          balance: {
            decrement: validateResponse?.data?.totalAmount
          },
        },
      });
      if(!senderWalletUpdate){
        console.log("Sender wallet decrement failed");
        return;
      }
  
      let storeData:any = make_withdrawal_data(makeData);
      let withdrawal_history = await prisma.withdraw_histories.create({ data : storeData });
      console.log('send job withdrawal data', withdrawal_history);

      if (address_type == ADDRESS_TYPE_INTERNAL) {
        console.log('withdrawal process','internal withdrawal');
        if (job_coin?.admin_approval == STATUS_ACTIVE) {
        } else{
            await prisma.withdraw_histories.update({ 
              where :{ 
                id : withdrawal_history.id 
              },
              data : {
                status : STATUS_ACTIVE
              }
            });
        }

        if ( receiverWallet ) {
            let depositData:any = makeDepositData(makeData);
            let depositeTransaction = await prisma.deposite_transactions.create({ data : depositData });
            console.log(depositeTransaction);
            if (job_coin?.admin_approval == STATUS_ACTIVE) {
                console.log('internal withdrawal process ', 'goes to admin approval');
                return generateSuccessResponse('Internal withdrawal process goes to admin approval');
            } else {
                await prisma.deposite_transactions.update({ 
                  where :{ id : depositeTransaction.id },
                  data : { status : STATUS_ACTIVE }
                });
                await prisma.wallets.update({ 
                  where :{ id : receiverWallet.id },
                  data : { balance : { increment : data.amount } }
                });
                console.log('internal withdrawal process ', 'completed');
                return generateSuccessResponse('Internal withdrawal process success');
            }
        }
      }else{
        console.log('withdrawal process','external withdrawal');
        if (job_coin?.admin_approval == STATUS_ACTIVE) {
            console.log('external withdrawal process ', 'goes to admin approval');
            return generateSuccessResponse('External withdrawal process goes to admin approval');
        } else {
            console.log('external withdrawal process ', 'just started');
            let externalProcess = await acceptPendingExternalWithdrawal(withdrawal_history,"");
            if(!externalProcess.success) {
                console.log('external withdrawal process failed', (externalProcess));
                console.log(' external withdrawal','so its goes to admin approval automatically');
                await prisma.withdraw_histories.update({ 
                  where: { id: withdrawal_history.id },
                  data: { automatic_withdrawal: 'failed' } 
                });
            } else {
              console.log('external withdrawal process ', 'end. withdrawal successfully');
            }
            return externalProcess;
        }
      }
      
    }
}

const acceptPendingExternalWithdrawal = async (withdrawal_history:any, adminID:any) => {
  if (adminID) {
      console.log('acceptPendingExternalWithdrawal', 'accept process started from admin end');
  } else {
      console.log('acceptPendingExternalWithdrawal', 'withdrawal process started from user end');
  }
  let currency = withdrawal_history.coin_type;
  let coin = await prisma.coins.findFirst({ where: { coin_type: currency } });
  let network:any = await prisma.networks.findFirst({ where: { id: Number(withdrawal_history.network_id) } });
  // let senderWallet = await prisma.wallet_address_histories.findFirst({ where: { wallet_id: Number(withdrawal_history.wallet_id), network_id: Number(network.id) } });
  let supportNetwork = await prisma.supported_networks.findFirst({ where: { slug: network?.slug } });
  let adminWallet = await prisma.admin_wallet_keys.findFirst({ where: { network_id: Number(network.id) } });
  let coinNetwork = await prisma.coin_networks.findFirst({ where: { network_id: Number(network.id), currency_id: Number(coin?.id) } });
  if (!adminWallet) {
    return generateErrorResponse("System wallet not found");
  }
  const coinDecimal = Number(coin?.decimal) > 0 ? Number(coin?.decimal) : 18;
  if (network  && (network.base_type == EVM_BASE_COIN || network.base_type == TRON_BASE_COIN)) {
      let tokenSendResponse = null;
      if(Number(coinNetwork?.type) == NATIVE_COIN){
        tokenSendResponse = (network.base_type == EVM_BASE_COIN) 
          ? await sendEthCoin(
            network.rpc_url,
            withdrawal_history.coin_type,
            coinDecimal,
            Number(supportNetwork?.gas_limit), 
            adminWallet?.address ?? "",
            withdrawal_history.address,
            withdrawal_history.amount,
            (adminWallet) ? await custome_decrypt(adminWallet.pv) : "",
          ) 
          : null ;
      }else{
        tokenSendResponse = (network.base_type == EVM_BASE_COIN) 
          ? await sendErc20Token(
            network.rpc_url, coinNetwork?.contract_address || '',
            withdrawal_history.coin_type,
            supportNetwork?.native_currency ?? "",
            coin?.decimal ?? 18,
            Number(supportNetwork?.gas_limit), 
            adminWallet?.address ?? "",
            withdrawal_history.address,
            (adminWallet) ? await custome_decrypt(adminWallet.pv) : "",
            withdrawal_history.amount
          ) 
          : await sendTrxToken(
            network.rpc_url,
            coinNetwork?.contract_address || '',
            (adminWallet) ? await custome_decrypt(adminWallet.pv) : "",
            withdrawal_history.address,
            withdrawal_history.amount
          ) ;
      }
      if (tokenSendResponse?.success) {
          await prisma.withdraw_histories.update({ 
            where: { id: withdrawal_history.id },
            data: {
              transaction_hash: tokenSendResponse.data.transaction_id,
              used_gas: tokenSendResponse.data.used_gas,
              status: STATUS_ACTIVE,
              updated_by: Number(adminID),
              automatic_withdrawal: adminID ? 'success' : ''
            } 
          });

          //dispatch(new DistributeWithdrawalReferralBonus($transaction))->onQueue('referral');
          if (adminID) {
            return generateSuccessResponse('User withdrawal processed successfully.');
          } else {
            return generateSuccessResponse('Pending withdrawal accepted Successfully.');
          }
      } else {
          return generateErrorResponse(tokenSendResponse?.message ?? "Token sending failed");
      }
  } else {
      return generateErrorResponse('No Api found');
  }
}

const make_withdrawal_data = (data:any):object => {
  return {
    user_id :Number( data.user.id),
    wallets : {
      connect: {
        id: data.wallet.id
      }
    },
    address : data.receiverWallet?.address || '',
    amount : Number(data.amount),
    address_type : data.address_type,
    fees : Number(data.fees),
    network_id: data.network_id,
    base_type: data.base_type,
    coin_type : data.wallet.coin_type,
    transaction_hash : data.trx,
    confirmations : '0',
    status : STATUS_PENDING,
    receiver_wallet_id : (data.receiverWallet) ? '0' : data.receiverWallet?.id,
    network_type : data.network_type ?? ""
  };
}

const makeDepositData = (data:any):object => {
    return {
        address : data.receiverWallet?.address,
        address_type : data.address_type,
        amount : data.amount,
        fees : data.fees,
        coin_type : data.wallet.coin_type,
        transaction_id : data.trx,
        confirmations : 0,
        status : STATUS_PENDING,
        sender_wallet_id : data.wallet.id,
        receiver_wallet_id : data.receiverWallet?.id,
        network_type : data.network_type ?? ""
    };
}

const checkWithdrawalValidation = async (request: any, user: any, wallet: any, coin: any) => {

  let responseData:any = {};

  // check wallet balance
  let fees = fees_calculator(request.amount, coin.withdrawal_fees, coin.withdrawal_fees_type);
  let totalAmount = Number(request.amount) + Number(fees);
  if(!(wallet.balance >= totalAmount)) return generateErrorResponse('Your wallet does not have enough balance');
  [responseData.totalAmount, responseData.fees] = [totalAmount, fees];

  // check internal address
  const address = await prisma.wallet_address_histories.findFirst({
    where: {
      address: request.address,
    }
  });
  if(address) {
      responseData.receiverAddress = address;
      let userWallet = await prisma.wallets.findFirst({
        where: {
          id: address.wallet_id,
        }
      });
      if(userWallet){
          responseData.receiverWallet = userWallet;
          // check own wallet address
          if(userWallet.user_id == user.id)
            return generateErrorResponse("You can not send to your own wallet!");
          // check coin type
          if(userWallet.coin_type != wallet.coin_type)
            return generateErrorResponse("Both wallet coin type should be same");
      }
  }
  console.log(totalAmount);
  // check coin status
  if(coin.status != STATUS_ACTIVE) return generateErrorResponse(coin.coin_type + " coin is inactive right now.");
  // check coin withdrawal status
  if(coin.is_withdrawal != STATUS_ACTIVE) return generateErrorResponse(coin.coin_type + " coin is not available for withdrawal right now");
  // check coin minimum withdrawal
  if(coin.minimum_withdrawal > totalAmount) return generateErrorResponse("Minimum withdrawal amount " + (coin.minimum_withdrawal).toFixed(8) + " " + coin.coin_type);
  // check coin maximum withdrawal
  if(coin.maximum_withdrawal < totalAmount) return generateErrorResponse("Maximum withdrawal amount " + (coin.maximum_withdrawal).toFixed(8) + " " + coin.coin_type);
  return generateSuccessResponse("validation success", responseData);
}

const checkBaseType = (type: number): boolean => {
   return (type == TRON_BASE_COIN || type == EVM_BASE_COIN);
}

const adminAcceptPendingWithdrawal = async (request:any) => {
  
  let withdrawHistory = await prisma.withdraw_histories.findFirst({ where: { id: Number(request.id) , status: STATUS_PENDING} });
  if(!withdrawHistory) return generateErrorResponse("Withdraw history not found");
  // let wallet = await prisma.wallets.findFirst({ where: { id: withdrawHistory.wallet_id } });
  // let user = await prisma.users.findFirst({ where: { id: withdrawHistory.user_id } });
  // let network = await prisma.networks.findFirst({ where: { id: Number(withdrawHistory.network_id) } });

  if (withdrawHistory.address_type == ADDRESS_TYPE_EXTERNAL){
      return await acceptPendingExternalWithdrawal(withdrawHistory,request.user.user_details.id);
  }
  return generateSuccessResponse("Withdrawal request is invalid");
}

export {
    createAddress,
    createSystemAddress,
    walletWithdrawalService,
    adminAcceptPendingWithdrawal,
}
