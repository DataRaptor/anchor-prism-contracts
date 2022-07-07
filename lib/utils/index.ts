
const numbers: string[] = [
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9"
]

const generateId = (): number => {
  const maxCharacters = 15;
  var id = ""
  while (id.length < maxCharacters){
    id +=  numbers[Math.floor(Math.random()*numbers.length)];
  }
  return Number(id)
  // const min: number = 0;
  // const max: number = 9999999999999;
  // return Math.floor(Math.random() * (max - min + 1) + min);
}

export const generateOrderId = (): number => {
  const id = Number(generateId())
  console.log("orderId", id)
  return id
};

export const generateProductId = (): number => {
  const id = Number(generateId())
  console.log("productId", id)
  return id
}