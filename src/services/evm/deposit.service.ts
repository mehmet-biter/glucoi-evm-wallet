import { PrismaClient } from "@prisma/client";
import { generateErrorResponse } from "../../utils/commonObject";
import { ADDRESS_TYPE_EXTERNAL, EVM_BASE_COIN, NATIVE_COIN, TOKEN_COIN, TRON_BASE_COIN } from "../../utils/coreConstant";
import { getLatestTransaction } from "./erc20.web3.service";
import { number } from "joi";
import { decodeInputParameter } from "./erc20.token.service";
import { addNumbers, createUniqueCode } from "../../utils/helper";

const prisma = new PrismaClient();

const checkCoinDeposit = async() => {
    try {
        let resultData: any = [];
        const networkData:any = await prisma.$queryRaw`
        SELECT * 
        FROM networks 
        JOIN notified_blocks ON networks.id = notified_blocks.network_id
        WHERE networks.status = 1`;

        if(networkData && networkData.length > 0) {
            for(let x = 0; x < networkData.length; x++) {
                if (networkData[x].rpc_url) {
                    if(networkData[x].base_type == EVM_BASE_COIN) {
                        
                        let setBlockNumber = networkData[x].block_number;
                        const transactions = await getLatestTransaction(networkData[x].rpc_url,networkData[x].block_number);
                        if (transactions && transactions.data.length > 0) {
                            const promises = transactions.data.map(async (res: any) => {
                                const checkDeposit: any = await checkNativeDepositAddress(networkData[x].rpc_url,res);
                                if (checkDeposit) {
                                resultData.push(checkDeposit);
                                }
                                setBlockNumber = res.block_number
                            });
                            await Promise.all(promises);
                            }
                        await updateNetworkBlockNumber(networkData[x].network_id,setBlockNumber);    
                    }
                }
            }
        }
        // const transactions = await getLatestTransaction('https://rpc.ankr.com/eth_goerli',9004290);
        

        
        console.log('resultData.....', resultData)
        console.log('checkCoinDeposit', 'executed');
        if (resultData && resultData.length > 0 ) {
            await depositUserWallet(resultData);
        }
        return [];
        // const networkData:any = await prisma.$queryRaw`
        // SELECT * 
        // FROM networks 
        // JOIN notified_blocks ON networks.id = notified_blocks.network_id
        // JOIN supported_networks ON supported_networks.slug = networks.slug
        // JOIN coin_networks ON networks.id = coin_networks.network_id
        // WHERE coin_networks.status = 1`;
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
const checkNativeDepositAddress = async(rpcUrl:string,res:any) => {
    let address = res.to_address;
    let tx = res.tx_hash;
    let inputs = res.input;
    let amount = res.amount
    console.log('address -> ', address);
    let walletAddress:any = null;
    let walletAddressData:any = null;
    if(address) {
        walletAddress = await prisma.wallet_address_histories.findMany({
            where:{
                address:address
            }
        });
        
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
                    const checkDepositTransaction = await prisma.deposite_transactions.findFirst({
                        where:{
                            address:address,
                            transaction_id: tx,
                            coin_id : Number(wallet.coin_id)
                        }
                    });
                    if (!checkDepositTransaction) {
                        walletAddressData = {
                            address : address,
                            receiver_wallet_id : Number(walletAddress.wallet_id),
                            address_type : ADDRESS_TYPE_EXTERNAL,
                            coin_type : walletAddress.coin_type,
                            amount : amount,
                            transaction_id : tx,
                            status : 1,
                            confirmations : 1,
                            from_address : res.from_address,
                            network_type : Number(walletAddress.network_id),
                            // uid : createUniqueCode(),
                            network_id : Number(walletAddress.network_id),
                            block_number : res.block_number,
                            coin_id :Number(walletAddress.coin_id),
                        }
                    }
                } 
            }
        } else {
            const checkContractAddress = await prisma.coin_networks.findFirst({
                where:{
                    contract_address:address
                }
            });
            if(checkContractAddress) {
                // console.log('checkContractAddress => ',checkContractAddress);
                const contractData = await decodeInputParameter(rpcUrl,address,inputs)
                console.log('contractData => ', contractData)
                console.log('contractData tx => ', tx)
                if(contractData) {
                    walletAddress = await prisma.wallet_address_histories.findFirst({
                        where:{
                            address:contractData.to_address,
                            network_id: Number(checkContractAddress.network_id),
                            coin_id:Number(checkContractAddress.currency_id)
                        }
                    });
                    if(walletAddress) {
                        const checkDepositTransaction = await prisma.deposite_transactions.findFirst({
                            where:{
                                address:contractData.to_address,
                                transaction_id: tx,
                                coin_id : Number(walletAddress.coin_id)
                            }
                        });
                        if (!checkDepositTransaction) {
                            walletAddressData = {
                                address : contractData.to_address,
                                receiver_wallet_id : Number(walletAddress.wallet_id),
                                address_type : ADDRESS_TYPE_EXTERNAL,
                                coin_type : walletAddress.coin_type,
                                amount : contractData.amount,
                                transaction_id : tx,
                                status : 1,
                                confirmations : 1,
                                from_address : res.from_address,
                                network_type : Number(walletAddress.network_id),
                                uid : createUniqueCode(),
                                network_id : Number(walletAddress.network_id),
                                block_number : res.block_number,
                                coin_id : Number(walletAddress.coin_id),
                            }
                        }
                    }
                }
                
            }
        }
    }
    console.log('walletAddressData => ',walletAddressData)
    return walletAddressData;
}

// insert deposit to user wallet
const depositUserWallet = async(depositData:any) => {
    if (depositData && depositData.length > 0) {
        for(let x = 0; x < depositData.length; x++) {
            const checkTransaction = await prisma.deposite_transactions.findFirst({
                where:{
                    transaction_id: depositData[x].transaction_id,
                    address:depositData[x].address
                }
            });
            const checkSystemWallet = await prisma.admin_wallet_keys.findFirst({
                where:{
                    address:depositData[x].from_address
                }
            });
            if (!checkTransaction && !checkSystemWallet) {
                const date = new Date();
                let prepare = depositData[x]
                prepare.address_type = (depositData[x].address_type).toString();
                prepare.network_type = (depositData[x].network_type).toString();
                prepare.block_number = (depositData[x].block_number).toString();
                prepare.created_at = date.toISOString();
                prepare.updated_at = date.toISOString();
                const createDeposit = await prisma.deposite_transactions.create({
                    data:prepare
                });
                console.log('createDeposit',createDeposit);
                if (createDeposit) {
                    const senderWalletUpdate = await prisma.wallets.update({
                        where: { id: Number(createDeposit?.receiver_wallet_id) },
                        data: {
                          balance: {
                            increment: createDeposit?.amount
                          },
                        },
                      });
                      console.log('senderWalletUpdate', senderWalletUpdate)
                }
            }
        }
    }
}
// update coin block number
const updateNetworkBlockNumber = async(network_id:any,block_number:number) => {
    let data:any=[];
    console.log(' updateNetworkBlockNumber network_id =>', network_id)
    console.log(' updateNetworkBlockNumber block_number =>', block_number)
    let blockNumber:any = addNumbers(block_number,1);
    console.log('blockNumber', blockNumber)
    blockNumber = blockNumber.toString();
    console.log(data,'updateNetworkBlockNumber')
    await prisma.notified_blocks.updateMany({
        where:{
            network_id:Number(network_id)
        },
        data:{
            block_number: blockNumber
        }
    })
}

export {
    checkCoinDeposit,
}