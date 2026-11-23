@scan
Feature: Running a security scan
  As a logged-in website owner
  I want to scan my website
  So that I can find and fix security weaknesses

  # Traces to TC-SCAN-01..03, TC-SCAN-05, TC-SCAN-07 and the production SSRF guard (see ../bdd-notes.md)
  # The target is a deliberately weak local test website (no security headers,
  # plain HTTP, an insecure cookie, jQuery 1.12.4). Real websites are never scanned.

  Background:
    Given a registered user "Alice" with email "alice@example.com" and password "Passw0rd1"

  @smoke
  Scenario: Scanning my own website produces a graded report
    When "Alice" scans the test website with ownership confirmed
    Then the response status should be 200
    And the report should have a grade from A to F and a score from 0 to 100
    And the report should be saved in the history of "Alice"

  Scenario Outline: The scanner detects each weakness of the test website
    When "Alice" scans the test website with ownership confirmed
    Then the report should include a "<category>" finding

    Examples:
      | category                      |
      | Missing Security Header       |
      | No HTTPS                      |
      | Cookie Missing HttpOnly Flag  |
      | Outdated / Vulnerable Library |

  Scenario: Redirects are followed and the final address is reported
    When "Alice" scans the test website path "/redirect" with ownership confirmed
    Then the response status should be 200
    And the report should say it was redirected to the test website home page

  Scenario: A scan needs the owner's permission
    When "Alice" scans the test website without confirming ownership
    Then the response status should be 400
    And the error message should be "You must confirm you own this website or have permission to scan it."

  Scenario Outline: Invalid target addresses are refused
    When "Alice" scans the address "<url>" with ownership confirmed
    Then the response status should be 400
    And the error message should be "<message>"

    Examples:
      | url                  | message                                                   |
      | example.com          | Please provide a valid URL including http:// or https://  |
      | ftp://127.0.0.1/file | URL must start with http:// or https://                   |

  Scenario: Scanning requires being logged in
    When an anonymous visitor scans the test website
    Then the response status should be 401

  @security @production @ssrf
  Scenario Outline: In production, internal network targets are blocked (SSRF)
    When "Alice" scans the address "<url>" with ownership confirmed
    Then the response status should be 400
    And the error message should be "<message>"

    Examples:
      | url                            | message                                                  |
      | http://localhost:8080/         | Scanning localhost or internal hostnames is not allowed  |
      | http://127.0.0.1/              | Scanning private or internal IP addresses is not allowed |
      | http://192.168.1.1/            | Scanning private or internal IP addresses is not allowed |
      | http://169.254.169.254/latest/ | Scanning private or internal IP addresses is not allowed |
      | http://[::1]/                  | Scanning private or internal IP addresses is not allowed |
