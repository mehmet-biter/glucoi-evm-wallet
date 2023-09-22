import { PrismaClient } from "@prisma/client";
import { generateErrorResponse } from "../../utils/commonObject";
import { EVM_BASE_COIN, NATIVE_COIN, TOKEN_COIN, TRON_BASE_COIN } from "../../utils/coreConstant";
import { getLatestTransaction } from "./erc20.web3.service";

const prisma = new PrismaClient();

const checkCoinDeposit = async() => {
    try {
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
                if (network.base_type == EVM_BASE_COIN) {
                    if (network.type == NATIVE_COIN) {
                        await checkEvmNativeDeposit(network);
                    } else {
                        await checkEvmTokenDeposit(network);
                    }
                }
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

const checkEvmNativeDeposit = async(network:any) => {
    console.log('checkEvmNativeDeposit', 'called')
    console.log('checkEvmNativeDeposit id =>', network.id)
    const transactions = await getLatestTransaction(network.rpc_url);
    // console.log('transactions', transactions)
    if (transactions.success == true) {
        if (transactions.data.length > 0 ) {
            transactions.data.map(async (transaction:any, index:number) => {
                console.log('single transaction 1',transaction);
                return;
                console.log('single transaction 2',transaction);
                // await updateNetworkBlockNumber(network.id,TOKEN_COIN,transaction.block_number)
            })
        }
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
const checkDepositAddress = async() => {

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