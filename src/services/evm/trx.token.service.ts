//@ts-ignore
import TronWeb from "tronweb";
import {
  generateErrorResponse,
  generateSuccessResponse,
} from "../../utils/commonObject";
import { powerOfTen } from "../../utils/helper";

const initializeTronWeb = async (rpcUrl: string) => {
  const tronWeb = new TronWeb({
    fullHost: rpcUrl,
    headers: {
      "TRON-PRO-API-KEY": process.env.TRONGRID_API_KEY,
    },
  });
  return tronWeb;
};

async function checkTx(tronWeb: any, txId: string) {
  return true;
  let txObj = await fetchTx(tronWeb, txId);
  if (txObj.hasOwnProperty("Error")) throw Error(txObj.Error);
  while (!txObj.hasOwnProperty("receipt")) {
    await new Promise((resolve) => setTimeout(resolve, 45000)); //sleep in miliseconds
    txObj = await fetchTx(tronWeb, txId);
  }
  if (txObj.receipt.result == "SUCCESS") return true;
  else return false;
}

async function fetchTx(tronWeb: any, txId: string) {
  return await tronWeb.trx.getTransactionInfo(txId);
}

const sendTrxToken = async (
  rpcUrl: string,
  contractAddress: string,
  privateKey: string,
  toAddress: string,
  amount: number
) => {
  try {
    const tronWeb = await initializeTronWeb(rpcUrl);

    tronWeb.setPrivateKey(privateKey);

    const contract = await tronWeb.contract().at(contractAddress);

    const decimalValue = await contract.decimals().call();

    const getDecimal = powerOfTen(decimalValue);
    amount = amount * getDecimal;

    const transaction = await contract
      .transfer(toAddress, BigInt(amount.toString()))
      .send();

    if (transaction) {
      const success = await checkTx(tronWeb, transaction);
      tronWeb.defaultPrivateKey = false;
      if (success) {
        const data = {
          hash: transaction,
          used_gas: 0,
        };
        return generateSuccessResponse("Transaction successful", data);
      } else {
        const data = {
          hash: transaction,
          used_gas: 0,
        };
        return generateErrorResponse(
          "Transaction failed. txid = " + transaction
        );
      }
    } else {
      tronWeb.defaultPrivateKey = false;
      const data = {
        data: transaction,
      };
      return generateErrorResponse("Transaction failed");
    }
  } catch (err) {
    return generateErrorResponse("Something went wrong");
  }
};


