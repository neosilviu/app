import os
import re
import json

directory = r'C:\app\core\marketplace'
translations = {
    "Nume": "Name", "Prenume": "First Name", "Nume de familie": "Last Name",
    "Telefon": "Phone", "Email": "Email", "Adresă": "Address",
    "Oraș": "City", "Țară": "Country", "Cod Poștal": "Zip Code",
    "Contact": "Contact", "Client": "Client", "Companie": "Company",
    "Etapă": "Stage", "Status": "Status", "Prioritate": "Priority",
    "Descriere": "Description", "Dată": "Date", "Valoare": "Value",
    "Estimată": "Estimated", "Cantitate": "Quantity", "Preț": "Price",
    "Titlu": "Title", "Buget": "Budget", "Zonă": "Area",
    "Produs": "Product", "Sursă": "Source", "Industrie": "Industry",
    "Monedă": "Currency", "Subiect": "Subject", "Responsabil": "Responsible",
    "Data Limită": "Due Date", "Agent": "Agent", "Canal": "Channel",
    "Rezultat": "Result", "Iterații": "Iterations", "Plan": "Plan",
    "Interval": "Interval", "Următoarea": "Next", "Factură": "Invoice",
    "Note": "Notes", "Reparație": "Repair", "Media": "Media",
    "Preparat": "Dish", "Categorie": "Category", "Proiect": "Project",
    "Deadline": "Deadline", "Serie": "Serial", "Garanție": "Warranty",
    "Poză": "Photo", "Resurse": "Resources", "Plată": "Payment",
    "Tip": "Type", "Data Start": "Start Date", "Produs Final": "Final Product",
    "Cantitate Planificată": "Planned Quantity", "Titlu Oportunitate": "Opportunity Title",
    "Nume Oportunitate": "Opportunity Name", "Companie / Contact": "Company / Contact",
    "Probabilitate Închidere (%)": "Closing Probability (%)", "Dimensiune Companie": "Company Size",
    "Data Început": "Start Date", "Buget Estimativ": "Estimated Budget",
    "Nume Proiect": "Project Name", "Titlu Task": "Task Title",
    "Nume Preparat": "Dish Name", "Obiect Reparație": "Repair Object",
    "Produs Asociat": "Associated Product", "Descriere Defect": "Defect Description",
    "Note Interne": "Internal Notes", "Soluție": "Solution",
    "Preț Reparație": "Repair Price", "Media Reparație": "Repair Media",
    "Ultima Reparație": "Last Repair", "Total Reparații": "Total Repairs",
    "Următoarea Factură": "Next Invoice", "Prompt / Obiectiv": "Prompt / Objective",
    "Rezultat Final": "Final Result", "Titlu / Scop": "Title / Purpose",
    "Valoare Estimată": "Estimated Value", "Remote Service ID": "Remote Service ID",
    "Canal (Agent Local)": "Channel (Local Agent)", "Canal (Extended AI)": "Channel (Extended AI)",
    "Data Estimată Închiderii": "Estimated Closing Date", "Client/Contact": "Client/Contact",
    "Nume Prompt": "Prompt Name", "Furnizor Implicit": "Default Provider",
    "Context Input (global, list, etc)": "Input Context (global, list, etc)",
    "Câmp Output": "Output Field", "Sistem / Blocat": "System / Locked",
    "Descrierea Sarcinii": "Task Description", "Data Achiziției": "Purchase Date",
    "Data Expirării": "Expiry Date", "Resurse GDrive": "GDrive Resources",
    "Preț Vânzare": "Sale Price", "Garanție Implicită": "Default Warranty",
    "Poză Produs": "Product Photo", "Tip Produs": "Product Type",
    "Serie/IMEI": "Serial/IMEI", "Dovadă Foto": "Photo Proof",
    "Status Plată": "Payment Status", "Dată Vizionare": "Viewing Date",
    "Proprietate": "Property", "Buget Client": "Customer Budget",
    "Zonă Preferată": "Preferred Area", "Nr. Înmatriculare": "License Plate",
    "Serie Șasiu (VIN)": "Chassis Number (VIN)", "Proprietar / Client": "Owner / Client",
    "Status Reparație": "Repair Status", "Cost Estimativ": "Estimated Cost",
    "Detalii Lucrare": "Work Details", "Număr Vehicule": "Vehicle Count",
    "Nume Locație": "Location Name", "Capacitate": "Capacity",
    "Dotări": "Amenities", "Data Programării": "Appointment Date",
    "Durată (min)": "Duration (min)", "Observații": "Observations",
    "Dată Scadență": "Due Date", "Sold": "Balance",
    "Venituri": "Incomes", "Cheltuieli": "Expenses",
    "Casier": "Cashier", "Metodă Plată": "Payment Method",
    "System Prompt": "System Prompt", "User Prompt Template": "User Prompt Template",
    "Model AI Interface": "Model AI Interface",
}

def translate_label(label_text):
    label_text = label_text.strip()
    if label_text in translations: return translations[label_text]
    for k, v in translations.items():
        if k.lower() == label_text.lower(): return v
    parts = re.split(r'([ /])', label_text)
    translated_parts = []
    for part in parts:
        if not part: continue
        if part in translations: translated_parts.append(translations[part])
        elif part.lower() in [k.lower() for k in translations.keys()]:
            for k, v in translations.items():
                if k.lower() == part.lower():
                    translated_parts.append(v)
                    break
        else: translated_parts.append(part)
    return "".join(translated_parts)

# This regex finds ANY label= and captures until a semicolon or the end of the string (before the quote)
pattern = re.compile(r'label=([^;\'"]+)')

for filename in os.listdir(directory):
    if filename == 'index.ts' or not filename.endswith('.ts'): continue
    filepath = os.path.join(directory, filename)
    with open(filepath, 'r', encoding='utf-8') as f: content = f.read()
    
    def replacer(match):
        val = match.group(1).strip()
        # If it's already a correct UI JSON, don't touch it
        if val.startswith('{') and val.endswith('}') and '"ro"' in val:
            return match.group(0)
        
        # If it's a broken JSON (trailing extra chars), fix it
        if val.startswith('{') and '"ro"' in val:
            # Try to extract the RO text from the partial JSON
            ro_match = re.search(r'\"ro\":\s*\"([^\"]+)\"', val)
            if ro_match:
                orig_ro = ro_match.group(1)
                # Recover the full original label if it leaked outside
                # e.g. {"ro": "ABC", "en": "XYZ"}) -> we want ABC plus whatever leaked
                # But it's easier to just re-translate the RO we found
                translated = translate_label(orig_ro)
                return 'label=' + json.dumps({"ro": orig_ro, "en": translated}, ensure_ascii=False)

        # Normal single string label
        translated = translate_label(val)
        return 'label=' + json.dumps({"ro": val, "en": translated}, ensure_ascii=False)

    new_content = pattern.sub(replacer, content)
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f: f.write(new_content)
        print(f"Updated {filename}")
