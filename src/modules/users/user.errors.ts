export type UserErrorCode =
  | "USER_NOT_FOUND"
  | "USERNAME_ALREADY_EXISTS"
  | "SELF_FOLLOW_FORBIDDEN"
  | "FOLLOW_ALREADY_EXISTS"
  | "FOLLOW_NOT_FOUND";

export class UserDomainError extends Error {
  constructor(
    readonly code: UserErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class UserNotFoundError extends UserDomainError {
  constructor(userId?: string, options?: ErrorOptions) {
    super(
      "USER_NOT_FOUND",
      userId ? `User ${userId} was not found` : "A referenced user was not found",
      options,
    );
  }
}

export class UsernameAlreadyExistsError extends UserDomainError {
  constructor(username: string, options?: ErrorOptions) {
    super("USERNAME_ALREADY_EXISTS", `Username ${username} is already in use`, options);
  }
}

export class SelfFollowError extends UserDomainError {
  constructor(options?: ErrorOptions) {
    super("SELF_FOLLOW_FORBIDDEN", "A user cannot follow itself", options);
  }
}

export class FollowAlreadyExistsError extends UserDomainError {
  constructor(options?: ErrorOptions) {
    super("FOLLOW_ALREADY_EXISTS", "The follow relationship already exists", options);
  }
}

export class FollowNotFoundError extends UserDomainError {
  constructor(options?: ErrorOptions) {
    super("FOLLOW_NOT_FOUND", "The follow relationship does not exist", options);
  }
}
