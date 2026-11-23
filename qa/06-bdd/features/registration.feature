@auth @registration
Feature: User registration
  As a website owner
  I want to create an account
  So that I can run security scans and keep my results

  # Traces to TC-REG-01..06, TC-REG-09, TC-REG-11 and Phase 3 EP/BVA classes (see ../bdd-notes.md)

  @smoke
  Scenario: A new visitor registers successfully
    When I register as "Alice" with email "alice@example.com" and password "Passw0rd1"
    Then the response status should be 201
    And I should receive an authentication token
    And the returned user should have the name "Alice" and email "alice@example.com"
    And the response should not contain a password

  Scenario: The stored password is hashed, never plain text
    When I register as "Alice" with email "alice@example.com" and password "Passw0rd1"
    Then the account for "alice@example.com" should store a bcrypt hash instead of "Passw0rd1"

  Scenario: An email address cannot be registered twice, in any letter case
    Given a registered user "Alice" with email "alice@example.com" and password "Passw0rd1"
    When I register as "Imposter" with email "ALICE@Example.com" and password "Passw0rd1"
    Then the response status should be 400
    And the error message should be "User already exists"

  # Equivalence classes and boundaries from Phase 3 (EP-PW, BVA-PW, EP-EM)
  Scenario Outline: Invalid registration details are rejected before reaching the database
    When I register as "<name>" with email "<email>" and password "<password>"
    Then the response status should be 400
    And the error message should be "<message>"
    And no account should exist for "<email>"

    Examples: password rules
      | name  | email             | password | message                                     |
      | Alice | pw7@example.com   | Passw0r  | Password must be at least 8 characters long |
      | Alice | pwnum@example.com | Password | Password must contain at least one number   |
      | Alice | pwnil@example.com |          | Password is required                        |

    Examples: email and name rules
      | name  | email              | password  | message                              |
      | Alice | not-an-email       | Passw0rd1 | Please provide a valid email address |
      | Alice | a@b                | Passw0rd1 | Please provide a valid email address |
      |       | noname@example.com | Passw0rd1 | Name is required                     |

  Scenario: The shortest allowed password (8 characters, one digit) is accepted
    When I register as "Alice" with email "edge@example.com" and password "abcdefg1"
    Then the response status should be 201

  @regression @DEF-005
  Scenario: A password sent as a number is rejected cleanly
    When I register with a JSON body where the password is the number 12345678
    Then the response status should be 400
    And the error message should be "Password must be text"
