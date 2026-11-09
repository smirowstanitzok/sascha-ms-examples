// src/price-handler.ts
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { buildFlagsUrl, loadFlags } from "./flags";
import { quotePrice, type SeatType } from "./pricing";

const FLAGS_URL = buildFlagsUrl();

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const flags = await loadFlags(FLAGS_URL);

  if (flags.salesStop.enabled) {
    return { statusCode: 503, body: JSON.stringify({ message: "Ticket sales are paused right now. Please try again later." }) };
  }

  const seat = (event.queryStringParameters?.seat ?? "standard") as SeatType;
  const tickets = Number(event.queryStringParameters?.tickets ?? "1");
  const showtime = new Date(event.queryStringParameters?.showtime ?? Date.now());
  if (!["standard", "premium"].includes(seat) || !Number.isInteger(tickets) || tickets < 1 || tickets > 10 || Number.isNaN(showtime.getTime())) {
    return { statusCode: 400, body: JSON.stringify({ message: "seat: standard or premium, tickets: 1 to 10, showtime: ISO date" }) };
  }

  const priceCent = quotePrice(seat, tickets, showtime, flags);
  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ seat, tickets, priceCent, sundayDiscount: flags.sundayDiscount.enabled }),
  };
};
