//@ts-ignore
import TronWeb from "tronweb";

import {
  generateErrorResponse,
  generateSuccessResponse,
} from "../../utils/commonObject";
import { powerOfTen } from "../../utils/helper";
import { error } from "console";

const initializeTronWeb = async (rpcUrl: string) => {
  const tronWeb = new TronWeb({
    fullHost: rpcUrl,
    headers: {
      "TRON-PRO-API-KEY": process.env.TRONGRID_API_KEY,
    },
  });
  return tronWeb;
};
const amountConvertToSun = async (tronWeb: any, amount: number) => {
  return parseFloat(tronWeb.toSun(amount));
};
const createTrxAddress = async (rpcUrl: string) => {
  try {
    const tronWeb = await initializeTronWeb(rpcUrl);
    const response = await tronWeb.createAccount();

    if (response) {
      const data = {
        address: response.address.base58,
        pk: response.privateKey,
        //publicKey: response.publicKey,
      };

      return generateSuccessResponse("TRC Wallet created successfully", data);
    } else {
      return generateErrorResponse("TRC Wallet not generated");
    }
  } catch (err) {
    console.log(err);
    return generateErrorResponse("Something went wrong");
  }
};

const getTrxBalance = async (rpcUrl: string, address: string) => {
  try {
    const tronWeb = await initializeTronWeb(rpcUrl);
    let balance = await tronWeb.trx.getBalance(address);

    if (balance) {
      balance = parseFloat(tronWeb.fromSun(balance));
      return generateSuccessResponse("Balance get successfully", balance);
    } else {
      return generateErrorResponse("Balance get failed", balance);
    }
  } catch (err) {
    console.log(err);
    return generateErrorResponse("Something went wrong");
  }
};

const sendTrxCoin = async (
  rpcUrl: string,
  toAddress: string,
  amount: number,
  privateKey: string
) => {
  try {
    const tronWeb = await initializeTronWeb(rpcUrl);

    const amountSun = await amountConvertToSun(tronWeb, amount);

    const checkAddress = await tronWeb.isAddress(toAddress);

    if (checkAddress) {
      const response = await tronWeb.trx.sendTransaction(
        toAddress,
        amountSun,
        privateKey
      );
      if (response && response.result == true) {
        const data = {
          hash: response.txid,
        };
        return generateSuccessResponse("Send trx success", data);
      } else {
        return generateErrorResponse("Send trx failed");
      }
    } else {
      return generateErrorResponse("Invalid address");
    }
  } catch (err) {
    console.log(err);
    return generateErrorResponse("Something went wrong");
  }
};

const getTrxAddressByPk = async (rpcUrl: string, privateKey: string) => {
  try {
    const tronWeb = await initializeTronWeb(rpcUrl);

    if (privateKey) {
      const response = await tronWeb.address.fromPrivateKey(privateKey);

      if (response) {
        const data = {
          address: response,
        };
        return generateSuccessResponse("TRC data get successfully", data);
      } else {
        return generateErrorResponse("Data get failed");
      }
    } else {
      return generateErrorResponse("Pk is required");
    }
  } catch (error) {
    console.error("An error occurred:", error);
    return generateErrorResponse("Something went wrong");
  }
};

const getTrxAccount = async (rpcUrl: string, address: string) => {
  try {
    const tronWeb = await initializeTronWeb(rpcUrl);

    if (address) {
      const response = await tronWeb.trx.getAccount(address);

      if (response) {
        return generateSuccessResponse("TRC data get successfully");
      } else {
        return generateErrorResponse("Data get failed");
      }
    } else {
      return generateErrorResponse("Address is required");
    }
  } catch (error) {
    return generateErrorResponse("Something went wrong");
  }
};

const checkTrxAddress = async (rpcUrl: string, address: string) => {
  try {
    const tronWeb = await initializeTronWeb(rpcUrl);

    if (address) {
      const response = await tronWeb.isAddress(address);
      if (response) {
        return generateSuccessResponse("Address valid", response);
      } else {
        return generateErrorResponse("Address not found");
      }
    } else {
      return generateErrorResponse("Address is required");
    }
  } catch (error) {
    return generateErrorResponse("Something went wrong");
  }
};

const getTrxTransactionBlock = async (
  rpcUrl: string,
  txId: string | null = "trx_hash"
) => {
  try {
    const tronWeb = await initializeTronWeb(rpcUrl);

    const response = await tronWeb.getEventByTransactionID(txId);

    if (typeof response == "object" && response.length > 0) {
      let transaction = response[0];
      let from = transaction.result.from;
      let to = transaction.result.to;
      transaction.result.from = tronWeb.address.fromHex(
        tronWeb.address.toHex(from)
      );
      transaction.result.to = tronWeb.address.fromHex(
        tronWeb.address.toHex(to)
      );

      return generateSuccessResponse(
        "Transaction details get successfully",
        transaction
      );
    } else {
      return generateErrorResponse("Transaction details not found");
    }
  } catch (error) {
    return generateErrorResponse("Something went wrong");
  }
};

const checkTrxDepositByBlockNumber = async(rpcUrl:string,blockNumber?:number) => {
  const tronWeb = await initializeTronWeb(rpcUrl);
  let blockNum:any = blockNumber;
  if(!blockNumber || blockNumber == 0) {
    blockNum = await getTrxCurrentBlockNumber(tronWeb);
  } 
  console.log('blockNum', blockNum)
  return await getTrxTransactionByBlockNumber(TronWeb,blockNum);
}

const getTrxTransactionByBlockNumber = async(tronWeb:any,blockNumber:number) => {
  try {
    console.log('blockNumber => ', blockNumber)
    await tronWeb.trx.getTransactionsFromThis(blockNumber, 100, 0).then((block:any) => {
      if (block) {
        console.log('Block Data:');
        console.log(JSON.stringify(block, null, 2));
      } else {
        console.log(`Block ${blockNumber} not found.`);
      }
    }).catch((error:any) => {
      console.log('Error:', error.message); // Log the error message
    });
  } catch(err) {
    console.log('getBlockByNum ex =>' , error)
  }
  
}

const getTrxCurrentBlockNumber = async(tronWeb:any) => {
  let latestBlockNumber = 0;
  const block = await tronWeb.trx.getCurrentBlock();
  if (block && block.block_header) {
     latestBlockNumber = block.block_header.raw_data.number; 
  }
  return latestBlockNumber;
}
export {
  initializeTronWeb,
  amountConvertToSun,
  createTrxAddress,
  getTrxBalance,
  sendTrxCoin,
  getTrxAddressByPk,
  getTrxAccount,
  checkTrxAddress,
  getTrxTransactionBlock,
  checkTrxDepositByBlockNumber
};
