import { Decimal } from "@prisma/client/runtime";
import * as safeMath from '@dip1059/safe-math-js';

export function setApp() {

}

export const powerOfTen = (x:any) => {
    return Math.pow(10,x);
}

export const customFromWei = async(amount:any,decimal:any) => {
    return (amount/powerOfTen(decimal)).toString();
}

export const convertCoinAmountToInt = (
    amount: Decimal | number,
    decimal: number,
  ): string => {
    let multiplier: any = '1';
    for (let i = 0; i < decimal; i++) {
      multiplier += '0';
    }
    const result = multiplyNumbers(Number(amount), Number(multiplier));
    return result.toString();
  }

export const convertCoinAmountFromInt = (
    amount: string | number,
    decimal: number,
  ): string => {
    let multiplier: any = '1';
    for (let i = 0; i < decimal; i++) {
      multiplier += '0';
    }
    const result = divideNumbers(Number(amount), Number(multiplier));
    return result.toString();
  }


  export const addNumbers = (...numbers: number[]): number  => {
    return safeMath.add(numbers);
  }
  
  export const minusNumbers =(...numbers: number[]): number => {
    return safeMath.minus(numbers);
  }
  
  export const multiplyNumbers = (...numbers: number[]): number => {
    return safeMath.multiply(numbers);
  }
  
  export const divideNumbers = (...numbers: number[]): number => {
    return safeMath.divide(numbers);
  }
  
  export const formatAmountDecimal = (amount: number, decimal: number): number  =>{
    return Number(amount.toFixed(decimal));
  }