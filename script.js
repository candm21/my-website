    // Initialize array to store values
let values = [];

// Reference to the table body
const tableBody = document.getElementById("itemTables");

// Function to handle Enter key press
function handleKeyPress(event) {
    if (event.key === 'Enter') {
        addItem();
    }
}

// Function to add a new item
function addItem() {
    // Get the user input value
    const itemValue = parseFloat(document.getElementById("itemValue").value);

    // Validate the input
    if (isNaN(itemValue)) {
        alert("Please enter a valid number.");
        return;
    }

    // Add the value to the array
    values.push(itemValue);

    // Create a new row
    const row = document.createElement("tr");

    // Create the item cell
    const itemCell = document.createElement("td");
    itemCell.textContent = `Item ${values.length}`;
    row.appendChild(itemCell);

    // Create the value cell
    const valueCell = document.createElement("td");
    valueCell.textContent = itemValue.toFixed(2); // Ensure two decimal places
    row.appendChild(valueCell);

    // Append the row to the table body
    tableBody.appendChild(row);

    // Update totals
    updateTotals();

    // Clear the input field
    document.getElementById("itemValue").value = '';
}

// Function to update totals
function updateTotals() {
    const totalItems = values.length;
    const totalValue = values.reduce((acc, curr) => acc + curr, 0);

    // Display totals with two decimal places
    document.getElementById("totalItems").textContent = totalItems;
    document.getElementById("totalValue").textContent = totalValue.toFixed(2);
}

	
	function refreshPage() {
    window.location.reload();
}
	
        function convertKgToGram() {
            const kg = parseFloat(document.getElementById('kgInput').value) || 0;
            const grams = kg * 1000;
            document.getElementById('gramOutput').textContent = `Equivalent in grams: ${grams} g`;
        }

        function updateRow(item) {
            const pricePerKg = parseFloat(document.getElementById(`${item}Price`).value) || 0;
            const weightInGrams = parseFloat(document.getElementById(`${item}Weight`).value) || 0;

            // Calculate the price for 100g and the entered weight
            const price100g = (pricePerKg / 1000) * 100;
            const amount = (pricePerKg / 1000) * weightInGrams;

            // Update the respective fields
            document.getElementById(`${item}100g`).textContent = price100g.toFixed(2);
            document.getElementById(`${item}Amount`).textContent = amount.toFixed(2);
        }

        function updateItemRow(item) {
            const pricePerItem = parseFloat(document.getElementById(`${item}Price`).value) || 0;
            const itemCount = parseFloat(document.getElementById(`${item}Count`).value) || 0;
            const total = pricePerItem * itemCount;

            // Update total for the item
            document.getElementById(`${item}Total`).textContent = total.toFixed(2);

            // Update grand total
            updateGrandTotal();
        }

function updateGrandTotal() {
    const items = ['fcm', 'orange', 'green', 'blue', 'curd', 'milk', 'dummy1', 'dummy2', 'dummy3'];
    let grandTotal = 0;

    items.forEach(item => {
        grandTotal += parseFloat(document.getElementById(`${item}Total`).textContent) || 0;
    });

    document.getElementById('itemGrandTotal').textContent = grandTotal.toFixed(2);
}
function displayDateTime() {
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    const formattedTime = now.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    document.getElementById('dateTimeRow').textContent = `Today's Date: ${formattedDate} | Current Time: ${formattedTime}`;
}

// Update date and time every second
setInterval(displayDateTime, 1000);

// Display date and time on page load
displayDateTime();

        // Initialize all rows
        ['milagu', 'thordall', 'cummin', 'rice'].forEach(updateRow);
        ['fcm', 'orange', 'green', 'blue', 'curd', 'milk'].forEach(updateItemRow);
		 displayDate();

        function calculate() {
            let price = parseFloat(document.getElementById("price").value);
            let weight = parseFloat(document.getElementById("weight").value);
            
            if (!isNaN(price) && !isNaN(weight) && weight > 0) {
                let pricePerKg = (price / weight) * 1000;
                let pricePer100g = pricePerKg / 10;
                let amount = (weight / 1000) * pricePerKg;
                
                document.getElementById("pricePerKg").innerText = pricePerKg.toFixed(2);
                document.getElementById("pricePer100g").innerText = pricePer100g.toFixed(2);
                document.getElementById("amount").innerText = amount.toFixed(2);
            } else {
                document.getElementById("pricePerKg").innerText = "-";
                document.getElementById("pricePer100g").innerText = "-";
                document.getElementById("amount").innerText = "-";
            }
        }


// script.js
document.addEventListener('DOMContentLoaded', function() {
    // Function to style custom tags
    function styleCustomTags(tagName, style) {
        const elements = document.querySelectorAll(tagName);
        
        elements.forEach(function(el) {
            const span = document.createElement('span');
            span.style[style] = style === 'fontWeight' ? 'bold' : 'italic';  // Set style
            span.innerHTML = el.innerHTML;    // Copy text content
            
            // Replace the custom tag with the new <span>
            el.parentNode.replaceChild(span, el);
        });
    }
    
    // Apply styles to <italic> and <bold> tags
    styleCustomTags('italic', 'fontStyle');
    styleCustomTags('bold', 'fontWeight');
});

