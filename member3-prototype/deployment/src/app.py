
import json
import os
import uuid
import boto3

from datetime import date, timedelta
from decimal import Decimal
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource("dynamodb")

BOOKINGS_TABLE = dynamodb.Table(os.environ["BOOKINGS_TABLE"])
RESERVATIONS_TABLE = dynamodb.Table(os.environ["RESERVATIONS_TABLE"])

LISTINGS = [
    {
        "id": 1,
        "name": "Modern Apartment",
        "location": "Ahmedabad",
        "price": 2500,
        "guests": 2,
        "rating": 4.8,
        "description": "Comfortable apartment in the city."
    },
    {
        "id": 2,
        "name": "Luxury Villa",
        "location": "Goa",
        "price": 6500,
        "guests": 6,
        "rating": 4.9,
        "description": "Beautiful villa near the beach."
    },
    {
        "id": 3,
        "name": "Mountain Retreat",
        "location": "Manali",
        "price": 3500,
        "guests": 4,
        "rating": 4.7,
        "description": "Peaceful mountain accommodation."
    },
    {
        "id": 4,
        "name": "Cozy Studio",
        "location": "Mumbai",
        "price": 1800,
        "guests": 2,
        "rating": 4.5,
        "description": "Affordable studio apartment."
    }
]


def response(status, body):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
        },
        "body": json.dumps(body, default=decimal_default)
    }


def decimal_default(value):
    if isinstance(value, Decimal):
        return int(value) if value % 1 == 0 else float(value)
    raise TypeError(f"Not JSON serializable: {type(value)}")


def get_params(event):
    return event.get("queryStringParameters") or {}


def get_body(event):
    try:
        return json.loads(event.get("body") or "{}")
    except (json.JSONDecodeError, TypeError):
        return None


def find_listing(listing_id):
    return next(
        (item for item in LISTINGS if item["id"] == listing_id),
        None
    )


def parse_dates(check_in, check_out):
    try:
        start = date.fromisoformat(check_in)
        end = date.fromisoformat(check_out)
    except (ValueError, TypeError):
        raise ValueError("Dates must use YYYY-MM-DD")

    if start < date.today() or end <= start:
        raise ValueError("Invalid booking dates")

    nights = (end - start).days

    if nights > 30:
        raise ValueError("Bookings cannot exceed 30 nights")

    return start, end


def reservation_ids(listing_id, start, end):
    return [
        f"{listing_id}#{(start + timedelta(days=i)).isoformat()}"
        for i in range((end - start).days)
    ]


def health_handler(event, context):
    return response(200, {"status": "healthy"})


def listings_handler(event, context):
    path = event.get("rawPath", "/listings")

    if path.startswith("/listings/"):
        try:
            listing_id = int(path.rsplit("/", 1)[-1])
        except ValueError:
            return response(404, {"error": "Listing not found"})

        listing = find_listing(listing_id)

        if not listing:
            return response(404, {"error": "Listing not found"})

        return response(200, listing)

    return response(200, LISTINGS)


def search_handler(event, context):
    params = get_params(event)

    location = params.get("location", "").lower().strip()

    try:
        max_price = (
            float(params["max_price"])
            if params.get("max_price") else None
        )
        guests = (
            int(params["guests"])
            if params.get("guests") else None
        )
    except ValueError:
        return response(400, {"error": "Invalid search filters"})

    results = LISTINGS

    if location:
        results = [
            item for item in results
            if location in item["location"].lower()
        ]

    if max_price is not None:
        results = [
            item for item in results
            if item["price"] <= max_price
        ]

    if guests is not None:
        results = [
            item for item in results
            if item["guests"] >= guests
        ]

    return response(200, results)


def availability_handler(event, context):
    params = get_params(event)

    try:
        listing_id = int(params.get("listing_id", ""))
        check_in = params.get("check_in", "")
        check_out = params.get("check_out", "")

        if not check_in or not check_out:
            raise ValueError("listing_id, check_in and check_out are required")

    except ValueError as error:
        return response(400, {"error": str(error)})

    if not find_listing(listing_id):
        return response(404, {"error": "Listing not found"})

    try:
        start, end = parse_dates(check_in, check_out)
    except ValueError as error:
        return response(400, {"error": str(error)})

    ids = reservation_ids(listing_id, start, end)

    try:
        result = dynamodb.meta.client.batch_get_item(
            RequestItems={
                RESERVATIONS_TABLE.name: {
                    "Keys": [{"reservation_id": item} for item in ids],
                    "ConsistentRead": True
                }
            }
        )

        occupied = result["Responses"].get(
            RESERVATIONS_TABLE.name, []
        )

        return response(200, {
            "listing_id": listing_id,
            "available": len(occupied) == 0
        })

    except Exception:
        return response(500, {"error": "Unable to check availability"})


def booking_handler(event, context):
    data = get_body(event)

    if data is None:
        return response(400, {"error": "Invalid JSON body"})

    required = ["listing_id", "guest_name", "check_in", "check_out"]

    if not all(data.get(field) for field in required):
        return response(400, {"error": "All booking fields are required"})

    if type(data["listing_id"]) is not int:
        return response(400, {"error": "listing_id must be an integer"})

    listing_id = data["listing_id"]
    guest_name = data["guest_name"]

    if not isinstance(guest_name, str) or not guest_name.strip():
        return response(400, {"error": "Invalid guest name"})

    if not find_listing(listing_id):
        return response(404, {"error": "Listing not found"})

    try:
        start, end = parse_dates(data["check_in"], data["check_out"])
    except ValueError as error:
        return response(400, {"error": str(error)})

    booking_id = str(uuid.uuid4())

    booking = {
        "booking_id": booking_id,
        "listing_id": listing_id,
        "guest_name": guest_name.strip(),
        "check_in": start.isoformat(),
        "check_out": end.isoformat(),
        "status": "confirmed"
    }

    client = dynamodb.meta.client

    transactions = [
        {
            "Put": {
                "TableName": RESERVATIONS_TABLE.name,
                "Item": {
                    "reservation_id": {"S": item},
                    "listing_id": {"N": str(listing_id)},
                    "booking_id": {"S": booking_id}
                },
                "ConditionExpression": "attribute_not_exists(reservation_id)"
            }
        }
        for item in reservation_ids(listing_id, start, end)
    ]

    transactions.append({
        "Put": {
            "TableName": BOOKINGS_TABLE.name,
            "Item": {
                "booking_id": {"S": booking_id},
                "listing_id": {"N": str(listing_id)},
                "guest_name": {"S": booking["guest_name"]},
                "check_in": {"S": booking["check_in"]},
                "check_out": {"S": booking["check_out"]},
                "status": {"S": "confirmed"}
            },
            "ConditionExpression": "attribute_not_exists(booking_id)"
        }
    })

    try:
        client.transact_write_items(TransactItems=transactions)
        return response(201, booking)

    except client.exceptions.TransactionCanceledException:
        return response(409, {
            "error": "Listing is already booked for these dates"
        })

    except Exception:
        return response(500, {"error": "Unable to create booking"})
