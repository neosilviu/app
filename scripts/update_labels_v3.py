import os
import re
import json

directory = r'C:\app\core\marketplace'
translations = {
    "Nume": "Name",
    "Prenume": "First Name",
    "Nume de familie": "Last Name",
    "Telefon": "Phone",
    "Email": "Email",
    "Adresă": "Address",
    "Oraș": "City",
    "Țară": "Country",
    "Cod Poștal": "Zip Code",
    "Contact": "Contact",
    "Client": "Client",
    "Companie": "Company",
    "Etapă": "Stage",
    "Status": "Status",
    "Prioritate": "Priority",
    "Descriere": "Description",
    "Dată": "Date",
    "Valoare": "Value",
    "Estimată": "Estimated",
    "Cantitate": "Quantity",
    "Preț": "Price",
    "Titlu": "Title",
    "Buget": "Budget",
    "Zonă": "Area",
    "Produs": "Product",
    "Sursă": "Source",
    "Industrie": "Industry",
    "Monedă": "Currency",
    "Subiect": "Subject",
    "Responsabil": "Responsible",
    "Data Limită": "Due Date",
    "Agent": "Agent",
    "Canal": "Channel",
    "Rezultat": "Result",
    "Iterații": "Iterations",
    "Plan": "Plan",
    "Interval": "Interval",
    "Următoarea": "Next",
    "Factură": "Invoice",
    "Note": "Notes",
    "Reparație": "Repair",
    "Media": "Media",
    "Preparat": "Dish",
    "Categorie": "Category",
    "Proiect": "Project",
    "Deadline": "Deadline",
    "Serie": "Serial",
    "Garanție": "Warranty",
    "Poză": "Photo",
    "Resurse": "Resources",
    "Plată": "Payment",
    "Tip": "Type",
    "Data Start": "Start Date",
    "Produs Final": "Final Product",
    "Cantitate Planificată": "Planned Quantity",
    "Titlu Oportunitate": "Opportunity Title",
    "Nume Oportunitate": "Opportunity Name",
    "Companie / Contact": "Company / Contact",
    "Probabilitate Închidere (%)": "Closing Probability (%)",
    "Dimensiune Companie": "Company Size",
    "Data Început": "Start Date",
    "Buget Estimativ": "Estimated Budget",
    "Nume Proiect": "Project Name",
    "Titlu Task": "Task Title",
    "Nume Preparat": "Dish Name",
    "Obiect Reparație": "Repair Object",
    "Produs Asociat": "Associated Product",
    "Descriere Defect": "Defect Description",
    "Note Interne": "Internal Notes",
    "Soluție": "Solution",
    "Preț Reparație": "Repair Price",
    "Media Reparație": "Repair Media",
    "Ultima Reparație": "Last Repair",
    "Total Reparații": "Total Repairs",
    "Următoarea Factură": "Next Invoice",
    "Prompt / Obiectiv": "Prompt / Objective",
    "Rezultat Final": "Final Result",
    "Titlu / Scop": "Title / Purpose",
    "Valoare Estimată": "Estimated Value",
    "Remote Service ID": "Remote Service ID",
    "Canal (Agent Local)": "Channel (Local Agent)",
    "Canal (Extended AI)": "Channel (Extended AI)",
    "Data Estimată Închiderii": "Estimated Closing Date",
    "Client/Contact": "Client/Contact",
    "Nume Prompt": "Prompt Name",
    "Furnizor Implicit": "Default Provider",
    "Context Input (global, list, etc)": "Input Context (global, list, etc)",
    "Câmp Output": "Output Field",
    "Sistem / Blocat": "System / Locked",
    "Descrierea Sarcinii": "Task Description",
    "Data Achiziției": "Purchase Date",
    "Data Expirării": "Expiry Date",
    "Resurse GDrive": "GDrive Resources",
    "Preț Vânzare": "Sale Price",
    "Garanție Implicită": "Default Warranty",
    "Poză Produs": "Product Photo",
    "Tip Produs": "Product Type",
    "Serie/IMEI": "Serial/IMEI",
    "Dovadă Foto": "Photo Proof",
    "Status Plată": "Payment Status",
    "Dată Vizionare": "Viewing Date",
    "Proprietate": "Property",
    "Buget Client": "Customer Budget",
    "Zonă Preferată": "Preferred Area",
    "Nr. Înmatriculare": "License Plate",
    "Serie Șasiu (VIN)": "Chassis Number (VIN)",
    "Proprietar / Client": "Owner / Client",
    "Status Reparație": "Repair Status",
    "Cost Estimativ": "Estimated Cost",
    "Detalii Lucrare": "Work Details",
    "Număr Vehicule": "Vehicle Count",
    "Nume Locație": "Location Name",
    "Capacitate": "Capacity",
    "Dotări": "Amenities",
    "Data Programării": "Appointment Date",
    "Durată (min)": "Duration (min)",
    "Observații": "Observations",
    "Dată Scadență": "Due Date",
    "Sold": "Balance",
    "Venituri": "Incomes",
    "Cheltuieli": "Expenses",
    "Casier": "Cashier",
    "Metodă Plată": "Payment Method",
    "Nr. Înmatriculare": "License Plate",
    "Serie Șasiu (VIN)": "Chassis Number (VIN)",
    "Proprietar / Client": "Owner / Client",
    "Status Reparație": "Repair Status",
    "Cost Estimativ": "Estimated Cost",
    "Detalii Lucrare": "Work Details",
}

def translate_label(label_text):
    label_text = label_text.strip()
    if label_text in translations:
        return translations[label_text]
    
    # Try case-insensitive
    for k, v in translations.items():
        if k.lower() == label_text.lower():
            return v
    
    # Heuristic: split by / or space and translate parts
    parts = re.split(r'([ /])', label_text)
    translated_parts = []
    for part in parts:
        if not part: continue
        if part in translations:
            translated_parts.append(translations[part])
        elif part.lower() in [k.lower() for k in translations.keys()]:
            # Find the value
            found = False
            for k, v in translations.items():
                if k.lower() == part.lower():
                    translated_parts.append(v)
                    found = True
                    break
            if not found: translated_parts.append(part)
        else:
            translated_parts.append(part)
    
    return "".join(translated_parts)

pattern = re.compile(r'label=([^;\'"{}]+)')

files_updated = []

for filename in os.listdir(directory):
    if filename == 'index.ts' or not filename.endswith('.ts'):
        continue
    
    filepath = os.path.join(directory, filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = content
    matches = list(pattern.finditer(content))
    
    for match in reversed(matches):
        full_match = match.group(0)
        label_value = match.group(1).strip()
        
        translated = translate_label(label_value)
        label_obj = {"ro": label_value, "en": translated}
        json_str = json.dumps(label_obj, ensure_ascii=False)
        replacement = f'label={json_str}'
        new_content = new_content[:match.start()] + replacement + new_content[match.end():]
    
    if new_content != content:
        with open(filepath, 'a', encoding='utf-8') as f:
             pass # just for verification
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        files_updated.append(filename)

print(json.dumps(files_updated))
