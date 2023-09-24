import { PrismaClient } from "@prisma/client";
import { generateErrorResponse } from "../../utils/commonObject";
import { EVM_BASE_COIN, NATIVE_COIN, TOKEN_COIN, TRON_BASE_COIN } from "../../utils/coreConstant";
import { getLatestTransaction } from "./erc20.web3.service";
import { number } from "joi";

const prisma = new PrismaClient();

const checkCoinDeposit = async() => {
    try {
        const transactions = await getLatestTransaction('https://rpc.ankr.com/eth_goerli',9733926);
        console.log('sss');
        let resultData: any = [];

        if (transactions && transactions.data.length > 0) {
        // Use map to create an array of promises
        const promises = transactions.data.map(async (res: any) => {
            const checkDeposit: any = await checkNativeDepositAddress(res.to_address);
            if (checkDeposit) {
            // console.log('checkDeposit', checkDeposit);
            const innerData = {
                wallet_id: checkDeposit.wallet_id.toString(),
                id: checkDeposit.id.toString(),
                network_id: checkDeposit.network_id.toString(),
                user_id: checkDeposit.user_id.toString(),
                address: checkDeposit.address,
                coin_type: checkDeposit.coin_type,
                coin_id: checkDeposit.coin_id
            };
            // console.log('innerData', innerData);
            resultData.push(innerData);
            }
        });

        // Wait for all promises to resolve
        await Promise.all(promises);
        }
        console.log('resultData.....', resultData)
        console.log('checkCoinDeposit', 'executed');
        return resultData;
        const networkData:any = await prisma.$queryRaw`
        SELECT * 
        FROM networks 
        JOIN notified_blocks ON networks.id = notified_blocks.network_id
        JOIN supported_networks ON supported_networks.slug = networks.slug
        JOIN coin_networks ON networks.id = coin_networks.network_id
        WHERE coin_networks.status = 1`;
        console.log('networks', networkData);
        if (networkData.length > 0) {
            networkData.map(async (network:any) => {
                console.log('map data', network);
                console.log(network.type,NATIVE_COIN)
                console.log('network.type == NATIVE_COIN', network.type == NATIVE_COIN)
                const transactions = await getLatestTransaction(network.rpc_url);
                return transactions;
                // if (network.base_type == EVM_BASE_COIN) {
                //     if (network.type == NATIVE_COIN) {
                //         await checkEvmNativeDeposit(network);
                //     } else {
                //         await checkEvmTokenDeposit(network);
                //     }
                // }
                if (network.base_type == TRON_BASE_COIN) {
                    if (network.type == NATIVE_COIN) {
                        await checkTrxNativeDeposit(network);
                    } else {
                        await checkTrxTokenDeposit(network);
                    }
                }
            })
        }
    } catch (err:any) {
        console.log('checkDeposit',err);
        return generateErrorResponse(err.stack)
    }
}

const checkEvmNativeDeposit = async(transaction:any) => {
    console.log('checkEvmNativeDeposit', 'called');
    // console.log('transaction', transaction)
    if(transaction) {

    }
}

const checkEvmTokenDeposit = async(network:any) => {
    console.log('checkEvmTokenDeposit', 'called')
    // const transactions = await 
}

const checkTrxNativeDeposit = async(network:any) => {
    // const transactions = await 
}

const checkTrxTokenDeposit = async(network:any) => {
    // const transactions = await 
}

// check deposit addrees
const checkNativeDepositAddress = async(address:string) => {
     const walletAddress = await prisma.wallet_address_histories.findMany({
        where:{
            address:address
        }
    });
    let walletAddressData:any = null;
    if (walletAddress && walletAddress.length > 0) {
        for(let i=0; i<walletAddress.length; i++) {
            const wallet:any = walletAddress[i];
            const checkNative = await prisma.coin_networks.findFirst({
                where:{
                    network_id:wallet.network_id,
                    currency_id:Number(wallet.coin_id),
                    type: NATIVE_COIN
                }
            });
            if (checkNative) {
                walletAddressData = walletAddress[i];
            }
        }
        return walletAddressData;
    } else {
        return null;
    }
}
// update coin block number
const updateNetworkBlockNumber = async(network_id:number,type:number,block_number:any) => {
    let data:any=[];
    if (type == TOKEN_COIN) {
        data.block_number = block_number;
    } else {
        data.token_block_number = block_number;
    }
    console.log(data)
    // await prisma.notified_blocks.update({
    //     where:{network_id:network_id},
    //     data:data
    // })
}

export {
    checkCoinDeposit,
}