export class ApiException extends Error {
  constructor(public message: string, public details: object=undefined, public code=400) {
    super();
  }

  public toJson() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}