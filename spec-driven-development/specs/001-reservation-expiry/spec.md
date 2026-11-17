# Feature: reservation with expiry

## User story
As a customer I want to reserve a bike at a station
so that it is still there when I arrive.

## Acceptance scenarios
- AS-1: If I reserve a free bike,
  it is held for me for 15 minutes.
- AS-2: After 15 minutes without pick-up,
  the reservation expires and the bike is free again.
- AS-3: With two open reservations already,
  a third one is rejected with a clear message.
- AS-4: Picking up the bike with a valid reservation
  changes the status to "picked up".

## Functional requirements
- FR-001: A reservation holds a bike for exactly 15 minutes.
- FR-002: Expired reservations count as expired immediately,
  even if the cleanup happens later.
- FR-003: At most two open reservations per person.
- FR-004: Pick-up is only possible with a valid reservation.

## Out of scope
- Payment, cancellation fees, notifications.

## Open questions
- [NEEDS CLARIFICATION] Does an expired reservation
  still count towards the limit in FR-003?
