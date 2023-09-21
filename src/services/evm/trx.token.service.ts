//@ts-ignore
import TronWeb from "tronweb";
//@ts-ignore
import TronGrid from "trongrid";
import axios from "axios";
import {
  generateErrorResponse,
  generateSuccessResponse,
} from "../../utils/commonObject";
import { powerOfTen } from "../../utils/helper";
import { amountConvertToSun } from "./trx.tron-web.service";

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

const getDecimalByContractAddress = async (contract: any) => {
  const decimalValue = await contract.decimals().call();
  return decimalValue;
};
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
    const decimalValue: number = await getDecimalByContractAddress(contract);
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

const getConfirmedTransaction = async (
  rpcUrl: string,
  contractAddress: string,
  txId: string
) => {
  try {
    const tronWeb = await initializeTronWeb(rpcUrl);

    const response = await tronWeb.trx.getTransactionInfo(txId);

    if (response) {
      const contract = await tronWeb.contract().at(contractAddress);

      const data = {
        hash: response,
        gas_used: parseFloat(tronWeb.fromSun(response.fee)),
        txID: response.id,
      };
      return generateSuccessResponse("Get transaction success", data);
    } else {
      return generateErrorResponse("Get transaction failed");
    }
  } catch (err) {
    return generateErrorResponse("Something went wrong");
  }
};

const getTornWebTransactionListByContractAddress = async (
  rpcUrl: string,
  contractAddress: string,
  adminAddress: string,
  lastTimeStamp: number
) => {
  try {
    const tronWeb = await initializeTronWeb(rpcUrl);

    const limit = 200;

    tronWeb.setAddress(adminAddress);
    const contract = await tronWeb.contract().at(contractAddress);

    const decimal = await getDecimalByContractAddress(contract);
    const getDecimal = powerOfTen(decimal);

    const tronGrid = new TronGrid(tronWeb);

    if (lastTimeStamp == 0) {
      var latestTransaction = await tronGrid.contract.getEvents(
        contractAddress,
        {
          only_confirmed: true,
          event_name: "Transfer",
          limit: limit,
          order_by: "timestamp,desc",
        }
      );

      lastTimeStamp = latestTransaction.data[0].block_timestamp;
    }

    var result = await tronGrid.contract.getEvents(contractAddress, {
      only_confirmed: true,
      event_name: "Transfer",
      limit: limit,
      order_by: "timestamp,asc",
      min_block_timestamp: lastTimeStamp,
    });

    let transactionData: any = [];
    if (result.data.length > 0) {
      result.data.map((tx: any) => {
        tx.from_address = tronWeb.address.fromHex(tx.result.from); // this makes it easy for me to check the address at the other end
        tx.to_address = tronWeb.address.fromHex(tx.result.to); // this makes it easy for me to check the address at the other end
        tx.amount = tx.result.value / getDecimal;
        tx.event = tx.event_name;
        tx.tx_hash = tx.transaction_id;
        transactionData.push(tx);
      });
    }

    const nextLink = result.meta.links?.next;

    if (result.meta.links) {
      transactionData = await hitNextLink(
        contractAddress,
        tronGrid,
        tronWeb,
        nextLink,
        transactionData,
        getDecimal,
        limit,
        lastTimeStamp
      );
    }
    const data = {
      result: transactionData,
    };
    return generateSuccessResponse("Get TRC20 token transactions", data);
  } catch (err) {
    return generateErrorResponse("Something went wrong");
  }
};

async function hitNextLink(
  contractAddress: string,
  tronGrid: any,
  tronWeb: any,
  nextLink: any,
  transactionData: any,
  getDecimal: number,
  limit: number,
  lastTimeStamp: number
) {
  try {
    var response;
    let recursiveStatus = true;

    if (limit >= 1000) {
      limit = 200;
      response = await tornGridApiCall(
        contractAddress,
        tronGrid,
        tronWeb,
        transactionData,
        lastTimeStamp,
        getDecimal,
        limit
      );

      transactionData = response.transactionData;
      nextLink = response.nextLink;
    } else {
      response = await axiosApiCall(
        tronWeb,
        nextLink,
        transactionData,
        getDecimal,
        recursiveStatus
      );

      limit += 200;

      transactionData = response.transactionData;
      nextLink = response.nextLink;
      recursiveStatus = response.recursiveStatus;
      lastTimeStamp = response.lastTimeStamp;
    }

    if (recursiveStatus == true) {
      await hitNextLink(
        contractAddress,
        tronGrid,
        tronWeb,
        nextLink,
        transactionData,
        getDecimal,
        limit,
        lastTimeStamp
      ); // Recursively call hitNextLink with the next link
    }

    return transactionData;
  } catch (error) {
    console.error("An error occurred:", error);
  }
}

async function tornGridApiCall(
  contractAddress: string,
  tronGrid: any,
  tronWeb: any,
  transactionData: any,
  lastTimeStamp: number,
  getDecimal: number,
  limit: number
) {
  var result = await tronGrid.contract.getEvents(contractAddress, {
    only_confirmed: true,
    event_name: "Transfer",
    limit: limit,
    order_by: "timestamp,asc",
    min_block_timestamp: lastTimeStamp,
  });
  if (result.data.length > 0) {
    result.data.map((tx: any) => {
      tx.from_address = tronWeb.address.fromHex(tx.result.from); // this makes it easy for me to check the address at the other end
      tx.to_address = tronWeb.address.fromHex(tx.result.to); // this makes it easy for me to check the address at the other end
      tx.amount = tx.result.value / getDecimal;
      tx.event = tx.event_name;
      tx.tx_hash = tx.transaction_id;
      transactionData.push(tx);
    });
  }

  const nextLink = result.meta.links.next;

  return { transactionData, nextLink };
}

async function axiosApiCall(
  tronWeb: any,
  nextLink: any,
  transactionData: any,
  getDecimal: number,
  recursiveStatus: boolean
) {
  const response = await axios.get(nextLink);
  const result = response.data;
  var lastTimeStamp;

  if (result.data.length > 0) {
    for (let i = 0; i < result.data.length; i++) {
      result.data[i].from_address = tronWeb.address.fromHex(
        result.data[i].result.from
      ); // this makes it easy for me to check the address at the other end
      result.data[i].to_address = tronWeb.address.fromHex(
        result.data[i].result.to
      ); // this makes it easy for me to check the address at the other end
      result.data[i].amount = result.data[i].result.value / getDecimal;
      result.data[i].event = result.data[i].event_name;
      result.data[i].tx_hash = result.data[i].transaction_id;
      transactionData.push(result.data[i]);

      lastTimeStamp = result.data[i].block_timestamp;
    }
  }

  recursiveStatus = result.meta.links ? true : false;

  nextLink = result.meta.links?.next;

  return { transactionData, nextLink, recursiveStatus, lastTimeStamp };
}

const getTrxConfirmedTransaction = async (
  rpcUrl: string,
  txId: string,
  contractAddress: string
) => {
  try {
    const tronWeb = await initializeTronWeb(rpcUrl);

    const response = await tronWeb.trx.getTransactionInfo(txId);

    if (response) {
      const contract = await tronWeb.contract().at(contractAddress);

      const data = {
        hash: response,
        gas_used: await amountConvertToSun(tronWeb,response.fee) ,
        txID: response.id,
      };

      return generateSuccessResponse("Get transaction success", data);
    } else {
      return generateErrorResponse("Get transaction failed");
    }
  } catch (error) {
    return generateErrorResponse("Something went wrong");
  }
};

const getTrc20TransferEvent = async (
  rpcUrl: string,
  contractAddress: string,
  adminAddress: string
) => {
  try {
    const tronWeb = await initializeTronWeb(rpcUrl);
    tronWeb.setAddress(adminAddress);

    const contract = await tronWeb.contract().at(contractAddress);

    const decimal = await getDecimalByContractAddress(contract);
    const getDecimal = powerOfTen(decimal);

    contract.Transfer().watch((err: any, event: any) => {
      if (err)
        return console.error(`USDT Transfer event error: ${err.toString()}`);

      if (event) {
        event.result.to = tronWeb.address.fromHex(event.result.to);
        event.result.from = tronWeb.address.fromHex(event.result.from);

        event.result.value = event.result.value / getDecimal;
        console.log(event);

        return generateSuccessResponse("success", event);
      }
    });
  } catch (error) {
    return generateErrorResponse("Something went wrong");
  }
};

const getTrxEstimateGas = async (
  rpcUrl: string,
  ownerWallet: string,
  receiverWallet: string,
  contractAddress: string,
  amount: number,
  perTrx: any
) => {
  try {
    const tronWeb = await initializeTronWeb(rpcUrl);

    const _function = "transfer(address,uint256)";
    const options = {
      feeLimit: 1_000_000,
      callValue: 0,
    };
    const parameter = [
      {
        name: "recipient",
        type: "address",
        value: receiverWallet,
      },
      {
        name: "amount",
        type: "uint256",
        value: amount,
      },
    ];
    const response = await tronWeb.transactionBuilder.triggerConstantContract(
      contractAddress,
      _function,
      options,
      parameter,
      ownerWallet
    );

    if (typeof response == "object" && response.result.result) {
      let energy = response.energy_used;
      let gas = (energy * perTrx) / 1000000;

      const data = {
        gas: gas,
        energy: energy,
      };
      return generateSuccessResponse("Estimted energy found successfully");
    } else {
      return generateErrorResponse("Estimted energy not found");
    }
  } catch (error) {
    return generateErrorResponse("Something went wrong");
  }
};

export {
  initializeTronWeb,
  checkTx,
  fetchTx,
  getDecimalByContractAddress,
  sendTrxToken,
  getConfirmedTransaction,
  getTornWebTransactionListByContractAddress,
  hitNextLink,
  tornGridApiCall,
  axiosApiCall,
  getTrxConfirmedTransaction,
  getTrc20TransferEvent,
  getTrxEstimateGas,
};
