@history
Feature: Managing my scan history
  As a logged-in user
  I want to review, annotate and delete my past scans
  So that I can track fixes over time, without anyone else seeing my results

  # Traces to TC-HIS-01, TC-HIS-03, TC-HIS-04, TC-NOTE-01, TC-NOTE-02, TC-NOTE-04, TC-DEL-01, TC-DEL-02 (see ../bdd-notes.md)

  Background:
    Given a registered user "Alice" with email "alice@example.com" and password "Passw0rd1"
    And a registered user "Bob" with email "bob@example.com" and password "Passw0rd1"
    And "Alice" has scanned the test website, saved as "alice-scan"
    And "Bob" has scanned the test website, saved as "bob-scan"

  @smoke
  Scenario: My history lists only my own scans, newest first
    Given "Alice" has scanned the test website, saved as "alice-scan-2"
    When "Alice" opens the scan history
    Then the response status should be 200
    And the history should list exactly "alice-scan-2, alice-scan" in that order

  Scenario: I can add a note to my scan
    When "Alice" adds the note "Add a Content-Security-Policy header" to "alice-scan"
    Then the response status should be 200
    And "alice-scan" should have the note "Add a Content-Security-Policy header"

  Scenario Outline: Note length limit (boundary value analysis)
    When "Alice" adds a note of <length> characters to "alice-scan"
    Then the response status should be <status>

    Examples:
      | length | status |
      | 0      | 200    |
      | 500    | 200    |
      | 501    | 400    |

  Scenario: I can delete my scan and it is gone
    When "Alice" deletes "alice-scan"
    Then the response status should be 200
    And "alice-scan" should no longer exist

  @security @idor
  Scenario Outline: Another user's scan is invisible to me
    When "Alice" tries to <action> "bob-scan"
    Then the response status should be 404
    And the error message should be "Scan result not found"
    And "bob-scan" should still exist without a note

    Examples:
      | action     |
      | view       |
      | add a note |
      | delete     |

  Scenario: A malformed scan ID is rejected
    When "Alice" tries to view "not-an-id"
    Then the response status should be 400
    And the error message should be "Invalid scan ID"
