@auth @login
Feature: User login
  As a registered user
  I want to log in
  So that I can see my scan history

  # Traces to TC-LOG-01..03, TC-LOG-05, TC-REG-09, TC-REG-10, TC-AUTH-01, TC-AUTH-03, TC-API-05 (see ../bdd-notes.md)

  Background:
    Given a registered user "Alice" with email "alice@example.com" and password "Passw0rd1"

  @smoke
  Scenario: Correct credentials give a working token
    When I log in with email "alice@example.com" and password "Passw0rd1"
    Then the response status should be 200
    And I should receive an authentication token
    And that token should let me view my profile as "Alice"

  Scenario: Email address is not case-sensitive at login
    When I log in with email "Alice@EXAMPLE.com" and password "Passw0rd1"
    Then the response status should be 200

  Scenario Outline: Wrong credentials get the same vague error
    When I log in with email "<email>" and password "<password>"
    Then the response status should be 401
    And the error message should be "Invalid email or password"
    And I should not receive an authentication token

    # The same message for both rows means an attacker cannot tell which
    # email addresses have accounts (no user enumeration).
    Examples:
      | email              | password   |
      | alice@example.com  | WrongPass1 |
      | nobody@example.com | Passw0rd1  |

  @regression @DEF-001
  Scenario: A Gmail user with dots and a +tag can log back in
    Given a registered user "Gina" with email "Gina.Smith+qa@gmail.com" and password "Passw0rd1"
    When I log in with email "Gina.Smith+qa@gmail.com" and password "Passw0rd1"
    Then the response status should be 200

  @regression @DEF-002
  Scenario: A malformed JSON body gets a clean 400, not a stack trace
    When I send a truncated JSON body to the login endpoint
    Then the response status should be 400
    And the response should not reveal a stack trace

  @security
  Scenario: Protected pages refuse requests without a valid token
    When I request my profile with the token "not-a-real-token"
    Then the response status should be 401
    And the error message should be "Invalid authorization token"

  @security @rate-limit
  Scenario: Repeated failed logins are throttled
    When I fail to log in 5 times in a row
    And I log in with email "alice@example.com" and password "Passw0rd1"
    Then the response status should be 429
    And the error message should be "Too many login attempts. Please try again in 15 minutes."
