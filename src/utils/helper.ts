
export const powerOfTen = (x:any) => {
    return Math.pow(10,x);
}

export const customFromWei = async(amount:any,decimal:any) => {
    return (amount/powerOfTen(decimal)).toString();
}