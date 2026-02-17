import os
import re
import json

directory = r'C:/app/core/marketplace'
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

# Matches .describe('...')
describe_pattern = re.compile(r"\.describe\('([^']+)'\)")

for filename in os.listdir(directory):
    if filename == 'index.ts' or not filename.endswith('.ts'): continue
    filepath = os.path.join(directory, filename)
    with open(filepath, 'r', encoding='utf-8') as f: content = f.read()
    
    def replacer(match):
        inner = match.group(1)
        # Split by semicolon, but handle JSON blocks containing semicolons if any?
        # Actually our JSON blocks don't contain semicolons normally, but just to be safe...
        # We can split by semicolon as long as it's not inside { }
        parts = []
        current = ""
        depth = 0
        for char in inner:
            if char == '{': depth += 1
            elif char == '}': depth -= 1
            
            if char == ';' and depth == 0:
                parts.append(current)
                current = ""
            else:
                current += char
        parts.append(current)
        
        new_parts = []
        for part in parts:
            if part.startswith('label='):
                val = part[6:].strip()
                # Extract real RO label from anywhere in the messy value
                ros = re.findall(r'"ro":\s*"([^"]+)"', val)
                if ros:
                    candidates = [r for r in ros if r != "{"]
                    ro = candidates[-1] if candidates else ros[-1]
                    en = translate_label(ro)
                    new_parts.append(f'label={json.dumps({"ro": ro, "en": en}, ensure_ascii=False)}')
                    continue
                else:
                    # Single string
                    translated = translate_label(val)
                    new_parts.append(f'label={json.dumps({"ro": val, "en": translated}, ensure_ascii=False)}')
                    continue
            new_parts.append(part)
        
        return f".describe('{';'.join(new_parts)}')"

    new_content = describe_pattern.sub(replacer, content)
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f: f.write(new_content)
        print(f"Fixed {filename}")
