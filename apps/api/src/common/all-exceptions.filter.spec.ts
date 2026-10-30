import { ArgumentsHost, HttpException } from "@nestjs/common";
import { AllExceptionsFilter } from "./all-exceptions.filter";
import { AppError } from "./error-response";

function hostWith(json: jest.Mock, status: jest.Mock): ArgumentsHost {
  return {
    switchToHttp: () => ({ getResponse: () => ({ status, json }) }),
  } as unknown as ArgumentsHost;
}

describe("AllExceptionsFilter", () => {
  let json: jest.Mock;
  let status: jest.Mock;
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });
    filter = new AllExceptionsFilter();
  });

  it("XC-05 U-ERR-01: maps an AppError to the error contract, preserving fieldErrors", () => {
    filter.catch(
      new AppError("VALIDATION_FAILED", "Check the form", 400, { email: ["Enter a valid email address"] }),
      hostWith(json, status),
    );
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      code: "VALIDATION_FAILED",
      message: "Check the form",
      fieldErrors: { email: ["Enter a valid email address"] },
    });
  });

  it("XC-05 U-ERR-01: maps a plain HttpException with fieldErrors null", () => {
    filter.catch(new HttpException("Nope", 403), hostWith(json, status));
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ code: "HTTP_ERROR", message: "Nope", fieldErrors: null });
  });

  it("XC-05 U-ERR-01: maps an unknown throw to a 500 without leaking the message", () => {
    filter.catch(new Error("connection string is postgres://user:hunter2@db"), hostWith(json, status));
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      code: "INTERNAL_ERROR",
      message: "Something went wrong",
      fieldErrors: null,
    });
  });
});
