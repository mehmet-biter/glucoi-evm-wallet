import { PrismaClient } from "@prisma/client";
import { EVM_BASE_COIN, STATUS_ACTIVE, STATUS_PENDING } from "../utils/coreConstant";
import { generateErrorResponse, generateSuccessResponse } from "../utils/commonObject";

const prisma = new PrismaClient();

const receiveDepositCoinProcess = async(request:any) => {
    try {
        if(request.transaction_id) {
            const transaction = await prisma.deposite_transactions.findFirst({
                where:{
                    AND:{
                        id:Number(request.transaction_id),
                        status:STATUS_ACTIVE,
                        is_admin_receive:STATUS_PENDING
                    }
                }
            });
            if(transaction && transaction.network_id) {
                const network_id = transaction.network_id;
                const coin_id = transaction.coin_id;
                const coinNetwork:any = await prisma.$queryRaw`
                SELECT * FROM coin_networks
                JOIN networks ON networks.id = coin_networks.network_id
                where coin_networks.network_id = ${network_id} and coin_networks.currency_id = ${coin_id}`;
    
                let coinNetworkData:any= {}
                if (coinNetwork) {
                    const coinNetworkData = coinNetwork[0]; // Extract the first item from the array

                    coinNetworkData.id = coinNetwork[0]?.id?.toString();
                    coinNetworkData.network_id = coinNetwork[0]?.network_id?.toString();
                    coinNetworkData.currency_id = coinNetwork[0]?.currency_id?.toString();
                                   
                    const systemWallet = await prisma.admin_wallet_keys.findFirst({
                        where:{
                            network_id:Number(coinNetworkData.network_id)
                        }
                    });
                    const userWallet = await prisma.wallets.findFirst({
                        where:{
                            id:transaction.receiver_wallet_id
                        }
                    });
                    const userWalletAddress =  await prisma.wallet_address_histories.findFirst({
                        where:{
                            address:transaction.address,
                            wallet_id:transaction.receiver_wallet_id,
                            coin_id:coinNetworkData.currency_id,
                            user_id:Number(userWallet?.user_id)
                        }
                    })
                    console.log('systemWallet', systemWallet);
                    console.log('coinNetworkData', coinNetworkData);
                    if (coinNetworkData.base_type == EVM_BASE_COIN) {

                    } else {
                        return generateSuccessResponse('Transaction',coinNetworkData);
                    }
                    return generateSuccessResponse('Transaction',coinNetworkData);
                } else {
                    return generateErrorResponse('Network not found');
                }
                
            } else {
                return generateErrorResponse('Transaction or network not found');
            }
        } else {
            return generateErrorResponse('Transaction id not found');
        }
    } catch (err:any) {
        console.log('receiveDepositCoinProcess',err);
        return generateErrorResponse(err.stack)
    }
}

// receive evm base coin and token
const receiveEthCoinOrTokenToSystemWallet = async () => {
    try {

    } catch(err:any) {
        console.log('receiveEthCoinOrTokenToSystemWallet',err);
        return generateErrorResponse(err.stack)
    }
}

export {
    receiveDepositCoinProcess,
}