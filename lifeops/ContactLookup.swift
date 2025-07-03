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

// Get phone number from command line arguments
guard CommandLine.arguments.count > 1 else {
    print("NOT_FOUND")
    exit(1)
}

let targetPhoneString = CommandLine.arguments[1]
debugLog("Looking up phone number: \(targetPhoneString)")

// Create CNPhoneNumber object for proper normalization
let targetPhoneNumber = CNPhoneNumber(stringValue: targetPhoneString)
debugLog("Created CNPhoneNumber: \(targetPhoneNumber.stringValue)")

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

debugLog("Permission granted, searching for contact...")

// Keys we need to fetch - minimal set for performance
let keys: [CNKeyDescriptor] = [
    CNContactGivenNameKey as CNKeyDescriptor,
    CNContactFamilyNameKey as CNKeyDescriptor,
    CNContactMiddleNameKey as CNKeyDescriptor,
    CNContactPhoneNumbersKey as CNKeyDescriptor,
    CNContactFormatter.descriptorForRequiredKeys(for: .fullName)
]

// Normalize target phone for comparison (last 10 digits)
let targetDigits = targetPhoneNumber.stringValue.filter("0123456789".contains)
let targetLast10 = targetDigits.count >= 10 ? String(targetDigits.suffix(10)) : targetDigits
debugLog("Target normalized to last 10 digits: \(targetLast10)")

// Use efficient enumeration with early termination on background queue
let request = CNContactFetchRequest(keysToFetch: keys)
var foundContact: CNContact?
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
                
                // Compare last 10 digits (US phone number standard)
                if phoneDigits.count >= 10 {
                    let contactLast10 = String(phoneDigits.suffix(10))
                    if contactLast10 == targetLast10 {
                        debugLog("Found matching contact: \(contact.givenName) \(contact.familyName)")
                        foundContact = contact
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

debugLog("Contact enumeration completed")
    
    if let contact = foundContact {
        // Use CNContactFormatter for proper name formatting
        let fullName = CNContactFormatter.string(from: contact, style: .fullName) ?? ""
        
        if !fullName.isEmpty {
            debugLog("Resolved to: \(fullName)")
            print(fullName)
        } else {
            // Fallback to manual name construction with middle name support
            let nameParts = [contact.givenName, contact.middleName, contact.familyName]
                .filter { !$0.isEmpty }
            let manualName = nameParts.joined(separator: " ")
            
            if !manualName.isEmpty {
                debugLog("Resolved to (manual): \(manualName)")
                print(manualName)
            } else {
                debugLog("Contact found but no name available")
                print("Unknown Contact")
            }
        }
    } else {
        debugLog("No contacts found matching phone number")
        print("NOT_FOUND")
    }