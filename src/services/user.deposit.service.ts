import { PrismaClient } from "@prisma/client";
import { EVM_BASE_COIN, STATUS_ACTIVE, STATUS_PENDING } from "../utils/coreConstant";
import { generateErrorResponse, generateSuccessResponse } from "../utils/commonObject";
import { getEthBalance, estimateEthFee, sendEthCoin, waitForTxConfirmedForGas, getGasPrice } from "./evm/erc20.web3.service";
import { custome_decrypt, customFromWei, multiplyNumbers } from "../utils/helper";
import { NATIVE_COIN } from "../utils/coreConstant";
import { sendErc20Token } from "./evm/erc20.token.service";
import Web3 from "web3";

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

                const coin:any = await prisma.coins.findFirst({ where:{ id:Number(coin_id) } });
                if(!coin) return generateErrorResponse('Coin not found');

                let coinNetworkData:any= {}
                if (coinNetwork.length){

                    const supported_network:any = await prisma.supported_networks.findFirst({ where:{ AND :{ slug:coinNetwork[0].slug }} });
                    if(!supported_network) return generateErrorResponse('Supported network not found');


                    coinNetworkData = coinNetwork[0]; // Extract the first item from the array

                    coinNetworkData.transaction_id  = transaction.id;
                    coinNetworkData.id              = coinNetwork[0]?.id?.toString();
                    coinNetworkData.network_id      = coinNetwork[0]?.network_id?.toString();
                    coinNetworkData.currency_id     = coinNetwork[0]?.currency_id?.toString();
                    coinNetworkData.coin_type       = coin.coin_type;
                    coinNetworkData.native_coin_type= supported_network.native_currency;
                    coinNetworkData.decimal         = coin.decimal;
                    coinNetworkData.gas_limit       = supported_network.gas_limit ?? 0;
                    coinNetworkData.from_address    = transaction.from_address;
                    coinNetworkData.amount          = transaction.amount;
                    coinNetworkData.blockConfirm    = coinNetwork[0]?.block_confirmation ?? 1;
                    coinNetworkData.is_native       = (coinNetwork[0]?.type == NATIVE_COIN) ? true : false;
                    coinNetworkData.contractAddress = coinNetwork[0]?.contract_address ?? null;
                                   
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
                            coin_id: Number(coinNetworkData?.currency_id),
                            user_id:Number(userWallet?.user_id)
                        }
                    })

                    if(!systemWallet) return generateErrorResponse('System wallet not found');
                    if(!userWallet) return generateErrorResponse('Deposited wallet not found');
                    if(!userWalletAddress) return generateErrorResponse('Deposited wallet address not found');

                    // console.log('systemWallet', systemWallet);
                    // console.log('coinNetworkData', coinNetworkData);
                    if (coinNetworkData.base_type == EVM_BASE_COIN) {
                        return await takeCoinFromEvmNetwork(coinNetworkData, systemWallet, userWalletAddress);
                    }
                    return generateErrorResponse('Transaction');
                } 
                return generateErrorResponse('Network not found');
            } 
            return generateErrorResponse('Transaction or network not found');
        } 
        return generateErrorResponse('Transaction id not found');
    } catch (err:any) {
        console.log('receiveDepositCoinProcess',err);
        return generateErrorResponse(err.message ?? "Something went wrong");
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

const takeCoinFromEvmNetwork = async (network:any, systemWallet:any, userWallet:any ):Promise<any> => {

    let userBalance = 0;
    let gas:any = 0;
    let sendAmount:any = 0;
    let needGas = true;


    // system wallet balance
    let systemWalletBalance = await getEthBalance(network.rpc_url, systemWallet.address);
    if(!(systemWalletBalance.hasOwnProperty("success") && systemWalletBalance.success))
            return generateErrorResponse(systemWalletBalance?.message ?? "System wallet balance check failed");

    // system wallet balance check
    if(!(Number(systemWalletBalance?.data) > 0)) 
            return generateErrorResponse("System wallet dose not have enough balance");

    // check user wallet balance
    let userWalletBalance = await getEthBalance(network.rpc_url, userWallet.address);
    if(!(userWalletBalance.hasOwnProperty("success") && userWalletBalance.success))
            return generateErrorResponse(userWalletBalance?.message ?? "User wallet balance check failed");
    userBalance = Number(userWalletBalance?.data);

    // Check Estimate Gas
    if(network.gas_limit > 0){
        // let gasToWei = (0.000000000000000001 * network.gas_limit).toString();
        const gas_price = await getGasPrice(network.rpc_url);
        let gasToWei = customFromWei(multiplyNumbers(network.gas_limit, Number(gas_price)),network.decimal);
        gas = parseFloat(gasToWei).toFixed(18);
        gas = Number(gas) + 0.000000000000001; // 16 diget
        sendAmount = gas ; 
        console.log("Has gas limit sendAmount", sendAmount);
    }else{
        console.log("Estimate gas limit");
        // let ethEstimateGas = await estimateGasFee(network.rpc_url, network.decimal, network.gas_limit, userWallet.address, network.amount, network.contractAddress);
        let ethEstimateGas = await estimateEthFee(
            network.rpc_url,
            network.coin_type,
            network.decimal,
            network.gas_limit,
            systemWallet.address,
            userWallet.address,
            network.amount
        );
        if(!(ethEstimateGas.hasOwnProperty("success") && ethEstimateGas.success))
                return generateErrorResponse(ethEstimateGas?.message ?? "Estimate gas check failed");
        gas = Number(ethEstimateGas?.data?.fees) + 0.000000000000001; 
        sendAmount = gas; console.log("sendAmount", sendAmount);
    }

    
    // user wallet balance check and gas set
    if((userBalance > 0)){
        if(network.is_native)
        userBalance = (userBalance > network.amount) ? (userBalance - network.amount) : (network.amount - userBalance);
        console.log("User Balance Has:", userBalance.toFixed(network.decimal));
        console.log("Estimate Gas Fee:", gas.toFixed(network.decimal));

        if((userBalance >= gas)){
            console.log("User Balance > Gas", true);
            console.log("Gas no need to send");
            needGas = false;
        }else{
            console.log("User Balance > Gas", false);
            sendAmount = gas - userBalance;
            console.log("Gas need to send:", sendAmount.toFixed(network.decimal));
        }
    }

    if(needGas){console.log("sendAmount", sendAmount);
        // send gas to user
        sendAmount = Number(sendAmount.toFixed(network.decimal));
        let sendNativeCoin = await sendEthCoin(
                network.rpc_url, 
                network.coin_type, 
                network.decimal, 
                network.gas_limit, 
                network.from_address, 
                userWallet.address, 
                sendAmount, 
                await custome_decrypt(systemWallet.pv)
        );
        if(!(sendNativeCoin.hasOwnProperty("success") && sendNativeCoin.success))
            return generateErrorResponse(sendNativeCoin?.message ?? "Gas sending failed");

        // wait for transaction to confirm by blockchain
        let waitForTransaction = await waitForTxConfirmedForGas(network.rpc_url, sendNativeCoin.data, network.blockConfirm);
        if(!(waitForTransaction.hasOwnProperty("success") && waitForTransaction.success))
            return generateErrorResponse(waitForTransaction?.message ?? "Transaction Failed");
    }

    // send coins to system wallet from user
    let sendToWystemWallet = (network.is_native) 
        ?  await sendEthCoin(
            network.rpc_url, 
            network.coin_type, 
            network.decimal, 
            network.gas_limit,
            userWallet.address,  
            systemWallet.address, 
            network.amount, 
            await custome_decrypt(userWallet.wallet_key)
        )
        : await sendErc20Token(
            network.rpc_url, 
            network.contractAddress, 
            network.coin_type, 
            network.native_coin_type, 
            18, // native coin decimal
            network.gas_limit,
            userWallet.address,
            systemWallet.address,
            await custome_decrypt(userWallet.wallet_key),
            network.amount,
        ) ;
    if(!(sendToWystemWallet.hasOwnProperty("success") && sendToWystemWallet.success))
        return generateErrorResponse(sendToWystemWallet?.message ?? "Coins received Failed");

    const transaction = await prisma.deposite_transactions.update({
        where:{ id: network.transaction_id  },
        data: { status : STATUS_ACTIVE, is_admin_receive: STATUS_ACTIVE, transaction_id: sendToWystemWallet.data.transaction_id}
    });

    return generateSuccessResponse("Coins received successfully", transaction);
}

export {
    receiveDepositCoinProcess,
}