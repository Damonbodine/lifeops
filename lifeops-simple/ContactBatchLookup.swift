#!/usr/bin/env swift

import Foundation
import Contacts

// MARK: - Utilities

func debugLog(_ message: String) {
    if ProcessInfo.processInfo.environment["DEBUG_CONTACT_LOOKUP"] == "1" {
        fputs("DEBUG: \(message)\n", stderr)
    }
}

// MARK: - Main Logic

// Get phone numbers from command line arguments (space-separated)
guard CommandLine.arguments.count > 1 else {
    print("USAGE: swift ContactBatchLookup.swift \"phone1\" \"phone2\" \"phone3\" ...")
    exit(1)
}

let targetPhoneStrings = Array(CommandLine.arguments.dropFirst())
debugLog("Batch lookup for \(targetPhoneStrings.count) phone numbers")

// Normalize all target phone numbers
var targetPhoneNumbers: [String: String] = [:]
for phoneString in targetPhoneStrings {
    let phoneNumber = CNPhoneNumber(stringValue: phoneString)
    let digits = phoneNumber.stringValue.filter("0123456789".contains)
    let last10 = digits.count >= 10 ? String(digits.suffix(10)) : digits
    targetPhoneNumbers[phoneString] = last10
    debugLog("Normalized \(phoneString) -> \(last10)")
}

let store = CNContactStore()

// Request permission to access contacts on background queue
var hasPermission = false
var permissionError: Error?
let semaphore = DispatchSemaphore(value: 0)

debugLog("Requesting contacts permission...")

// Use background queue for permission request
DispatchQueue.global(qos: .userInitiated).async {
    store.requestAccess(for: .contacts) { granted, error in
        hasPermission = granted
        permissionError = error
        semaphore.signal()
    }
}

semaphore.wait()

guard hasPermission else {
    if let error = permissionError {
        debugLog("Permission error: \(error.localizedDescription)")
        print("ERROR: No permission to access contacts - \(error.localizedDescription)")
    } else {
        debugLog("Permission denied by user")
        print("ERROR: No permission to access contacts - Permission denied")
    }
    exit(1)
}

debugLog("Permission granted, starting batch contact search...")

// Keys we need to fetch - minimal set for performance
let keys: [CNKeyDescriptor] = [
    CNContactGivenNameKey as CNKeyDescriptor,
    CNContactFamilyNameKey as CNKeyDescriptor,
    CNContactMiddleNameKey as CNKeyDescriptor,
    CNContactPhoneNumbersKey as CNKeyDescriptor,
    CNContactFormatter.descriptorForRequiredKeys(for: .fullName)
]

// Track results
var results: [String: String] = [:]
var processedCount = 0

// Use efficient enumeration with early termination on background queue
let request = CNContactFetchRequest(keysToFetch: keys)
var contactError: Error?
let searchSemaphore = DispatchSemaphore(value: 0)

// Perform contact search on background queue for better performance
DispatchQueue.global(qos: .userInitiated).async {
    do {
        try store.enumerateContacts(with: request) { contact, stop in
            // Check each phone number for this contact
            for phoneNumber in contact.phoneNumbers {
                let phoneValue = phoneNumber.value.stringValue
                let phoneDigits = phoneValue.filter("0123456789".contains)
                
                // Compare last 10 digits with all target numbers
                if phoneDigits.count >= 10 {
                    let contactLast10 = String(phoneDigits.suffix(10))
                    
                    // Check if this contact matches any of our target numbers
                    for (originalPhone, targetLast10) in targetPhoneNumbers {
                        if contactLast10 == targetLast10 && results[originalPhone] == nil {
                            // Build full name
                            let fullName = CNContactFormatter.string(from: contact, style: .fullName) ?? ""
                            if !fullName.isEmpty {
                                results[originalPhone] = fullName
                                debugLog("Found: \(originalPhone) -> \(fullName)")
                            } else {
                                // Fallback to manual name construction
                                let nameParts = [contact.givenName, contact.middleName, contact.familyName]
                                    .filter { !$0.isEmpty }
                                let manualName = nameParts.joined(separator: " ")
                                results[originalPhone] = manualName.isEmpty ? "Unknown Contact" : manualName
                                debugLog("Found (manual): \(originalPhone) -> \(results[originalPhone]!)")
                            }
                            processedCount += 1
                        }
                    }
                    
                    // Early termination if we found all contacts
                    if processedCount >= targetPhoneStrings.count {
                        stop.pointee = true
                        return
                    }
                }
            }
        }
    } catch {
        contactError = error
    }
    searchSemaphore.signal()
}

searchSemaphore.wait()

if let error = contactError {
    debugLog("Contact enumeration error: \(error.localizedDescription)")
    print("ERROR: \(error.localizedDescription)")
    exit(1)
}

debugLog("Batch contact enumeration completed. Found \(results.count) of \(targetPhoneStrings.count) contacts")

// Output results in JSON format for easy parsing
var jsonResults: [String: String] = [:]
for phoneString in targetPhoneStrings {
    jsonResults[phoneString] = results[phoneString] ?? "NOT_FOUND"
}

do {
    let jsonData = try JSONSerialization.data(withJSONObject: jsonResults, options: [])
    if let jsonString = String(data: jsonData, encoding: .utf8) {
        print(jsonString)
    } else {
        print("ERROR: Failed to encode JSON results")
        exit(1)
    }
} catch {
    print("ERROR: Failed to serialize JSON: \(error.localizedDescription)")
    exit(1)
}