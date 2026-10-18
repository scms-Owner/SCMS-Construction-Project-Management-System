-- Import the owner's uploaded RIVER CTG payment schedule into the main-contract ledger.
-- Amounts are stored as line-level lump-sum schedule values (unit LS, quantity 1), not unit rates.
-- Source discrepancy is deliberately retained in the project notes: numeric total BDT 3,259,141;
-- amount in words says BDT 3,752,000. Confirm source document before official client billing.
BEGIN;
DO $$
DECLARE pid uuid;
BEGIN
  INSERT INTO scms.projects(project_code,name,site_address,client_name,budget,contract_value,status,notes)
  VALUES ('RIVER-CTG-01','RIVER CTG – Civil Works','Chattogram','As per uploaded payment schedule',3259141,3259141,'ACTIVE',
  'Imported from SCMS_River_CTG_Payment_Schedule.xlsx. Amount-in-words conflicts with numeric grand total: numeric total BDT 3,259,141 vs written amount BDT 3,752,000. Confirm before official billing.')
  ON CONFLICT(project_code) DO UPDATE SET name=EXCLUDED.name,site_address=EXCLUDED.site_address,client_name=EXCLUDED.client_name,
  budget=EXCLUDED.budget,contract_value=EXCLUDED.contract_value,status=EXCLUDED.status,notes=EXCLUDED.notes,updated_at=now()
  RETURNING id INTO pid;
  INSERT INTO scms.main_contracts(project_id,client_name,contract_ref,contract_value,currency)
  VALUES(pid,'As per uploaded payment schedule','RIVER CTG | Option-01 & 05',3259141,'BDT')
  ON CONFLICT(project_id) DO UPDATE SET client_name=EXCLUDED.client_name,contract_ref=EXCLUDED.contract_ref,contract_value=EXCLUDED.contract_value;
  INSERT INTO scms.main_boq_items(project_id,item_code,description,unit,main_rate,quantity,revision,active)
  SELECT pid,v.code,v.description,v.unit,v.amount,1,1,true
  FROM (VALUES
('A-01','Earth Cutting','LS',75796,1),
('A-02','Pile Cap B. Beam with Brick Work','LS',181910,1),
('A-04','Short Column, Grade Beam, URWT Tank wall and Top Slab including Inside NCF','LS',174331,1),
('A-05','Apron Work and handicraft Ramp','LS',121274,1),
('A-06','GF Casting With Compaction','LS',136433,1),
('A-07','G.F Column with Ramp Column','LS',51541,1),
('A-08','1st Floor Column','LS',60637,1),
('A-09','2nd Floor Column','LS',68216,1),
('A-10','1st Slab','LS',288025,1),
('A-11','2nd Slab','LS',295604,1),
('A-12','3rd Slab','LS',310764,1),
('A-13','Ramp Floor','LS',75796,1),
('A-14','Ramp Railing','LS',45778,1),
('A-16','1st Floor Railing','LS',46994,1),
('A-17','Chilakhotha Floor','LS',60637,1),
('A-18','Chilakhotha Parapet','LS',22739,1),
('A-19','Roof Top Parapet','LS',60637,1),
('A-21','Ground Floor and Apron With NCF (Patent Stone Work)','LS',60637,1),
('A-22','1st Floor Patent Stone Work','LS',30318,1),
('A-23','Ramp Patent Stone Work','LS',30318,1),
('A-24','Roof Top with NCF (Patent Stone Work)','LS',53057,1),
('A-25','GF Ceiling plaster, BW Plaster and others','LS',45478,1),
('A-26','1st Floor Ceiling plaster, BW Plaster and others','LS',45478,1),
('A-27','2nd Floor Ceiling plaster, BW Plaster, Black Board Making and others','LS',121274,1),
('A-28','Chilakotha Inside, outside, Top water Reserver with NCF','LS',45478,1),
('A-29','Ground Floor Collapsible Gate Fitting','LS',37898,1),
('A-30','1st Floor Grill Fitting','LS',37898,1),
('A-31','Chowkath & Grill Fitting, Bathroom MS Door Fitting','LS',181910,1),
('A-33','Chilakotha MS Door and Solar Grill Fitting','LS',37898,1),
('A-35','Outside Plaster - Front','LS',75796,1),
('A-36','Outside Plaster - Left','LS',30318,1),
('A-37','Outside Plaster - Right','LS',30318,1),
('A-38','Outside Plaster - Back','LS',90955,1),
('B-01','Shutter Repairing','LS',60000,1),
('B-02','Sand Compaction with carrying','LS',20000,1),
('B-03','Fuel','LS',40000,1),
('B-04','Ring Tank with Plaster','LS',27000,1),
('B-05','Solar Base with NCF and Ladder Fitting','LS',10000,1),
('B-09','False Column with Plaster','LS',20000,1),
('B-10','Pile Head Breaking','LS',40000,1),
('B-11','CC Works (Pile Cap, B. Beam, URWT Tank and G. Beam)','LS',10000,1)
  ) AS v(code,description,unit,amount)
  ON CONFLICT(project_id,item_code,revision) DO UPDATE SET description=EXCLUDED.description,unit=EXCLUDED.unit,main_rate=EXCLUDED.main_rate,quantity=1,active=true;
END $$;
COMMIT;
